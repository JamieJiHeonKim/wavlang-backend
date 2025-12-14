const express = require('express');
const cors = require('cors');
const multer = require('multer')
const FormData = require('form-data');
const { Readable } = require('stream');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffmetadata = require('ffmetadata');
const path = require('path');
const fileUpload = require('express-fileupload');
const mongoose = require('mongoose');
const passport = require("passport");
const OAuth2Strategy = require("passport-google-oauth2").Strategy;
const userdb = require('./models/UserModel');
const verificationTokendb = require('./models/VerificationToken');
const stripeRoutes = require("./routes/StripeRoutes");

require('dotenv').config()

const apiKey = process.env.REACT_APP_ASSEMBLY_API_KEY;
const baseUrl = 'https://api.assemblyai.com/v2';
const googleOAuthCliendId = process.env.GOOGLE_CLIENT_ID;
const googleOAuthClientSecret = process.env.GOOGLE_CLIENT_SECRET;


const userRoutes = require('./routes/userRoutes');

const headers = {
    authorization: apiKey
};

const app = express();

app.use(cors());
app.use(express.json());
app.use(fileUpload());


const bufferToStream = (buffer) => {
    return Readable.from(buffer);
}

/**
 * Convert a time string of the format 'mm:ss' into seconds.
 * @param {string} timeString - A time string in the format 'mm:ss'.
 * @return {number} - The time in seconds.
 */
const parseTimeStringToSeconds = timeString => {
    const [minutes, seconds] = timeString.split(':').map(tm => parseInt(tm));
    return minutes * 60 + seconds;
}

const upload = multer();
ffmpeg.setFfmpegPath(ffmpegPath);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

// app.get("/api", (req, res) => {
//     res.json({ message: "Hello from server!" });
// });

app.use('/api', userRoutes);
app.use('/api/stripe', stripeRoutes);
app.use((req, res, next) => {
    console.log(req.path, req.method);
    next();
});

function getFiles(audioStream, tempFileName, endTime, outputFileName, timeDuration) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            audioStream.pipe(fs.createWriteStream(tempFileName))
            .on('finish', () => {
                ffmetadata.read(tempFileName, (err, metadata) => {
                    if (err) reject(err);
                    const duration = parseFloat(metadata.duration);
                    if (endTime > duration) endTime = duration;

                    ffmpeg(tempFileName)
                        .setStartTime(startSeconds)
                        .setDuration(timeDuration)
                        .output(outputFileName)
                        .on('end', () => {
                            fs.unlink(tempFileName, (err) => {
                                if (err) console.error('Error deleting temp file:', err);
                            });

                            const trimmedAudioBuffer = fs.readFileSync(outputFileName);
                            fs.unlink(outputFileName, (err) => {
                                if (err) console.error('Error deleting output file:', err);
                            });

                            resolve(trimmedAudioBuffer);
                        })
                        .on('error', reject)
                        .run();
                });
            })
            .on('error', reject);
        }, 100000);
    });
};

function getAssemblyAIFile (audioData) {
    const res = axios.post(`${baseUrl}/upload`, audioData, {
        headers
    });
    return(res);
};

app.post('/api/transcribe_assemblyai', async (req, res) => {
    console.log(req.files);
    try {
        if (!req.files || !req.files.audioFile) {
            return res.status(400).json({ message: 'Audio file is required.' });
        }

        const audioFile = req.files.audioFile;
        const uploadResponse = await getAssemblyAIFile(audioFile.data);
        const uploadUrl = uploadResponse.data.upload_url;

        const data = {
            audio_url: uploadUrl
        };

        const url = `${baseUrl}/transcript`;
        const response = await axios.post(url, data, { headers: headers });
        const transcriptId = response.data.id;
        const pollingEndpoint = `${baseUrl}/transcript/${transcriptId}`;

        while (true) {
            const pollingResponse = await axios.get(pollingEndpoint, { headers: headers });
            const transcriptionResult = pollingResponse.data;
            // const transcriptionHighlight = pollingResponse.data.auto_highlights_result;
            // console.log("transcriptionHighlight:", transcriptionHighlight);

            // if (transcriptionResult.status === 'completed' && transcriptionHighlight.status === 'success') {
            if (transcriptionResult.status === 'completed') {
                // console.log(transcriptionResult);
                // for (const utterance of transcriptionResult.utterance) {
                //     console.log(`Speaker ${utterance.speaker}: ${utterance.text}`)
                // }
                console.log(transcriptionResult.text);
                return res.json({ transcriptionResult });
            } else if (transcriptionResult.status === 'error') {
                throw new Error(`Transcription failed: ${transcriptionResult.error}`);
            } else {
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.post('/api/transcribe_file', upload.single('file'), async (req, res) => {
    const audioFile = req.file;
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;

    if (!audioFile) {
        res.status(400).json({ message: 'Audio file is required.' });
        return;
    }

    if (!startTime || !endTime) {
        res.status(400).json({ message: 'Start and end times are required.' });
        return;
    }

    // Parse and calculate the duration
    const startSeconds = parseTimeStringToSeconds(startTime);
    const endSeconds = parseTimeStringToSeconds(endTime);
    const timeDuration = endSeconds - startSeconds;

    try {
        const audioFile = req.file;
        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file provided' });
        }
        console.log("audioFile:", audioFile);
        const audioStream = Readable.from(audioFile.buffer);
        console.log('audioStream:', audioStream);

        const trimAudio = async (audioStream, endTime) => {
            const tempFileName = `temp-${Date.now()}.mp3`;
            const outputFileName = `output-${Date.now()}.mp3`;
            getFiles(audioStream, tempFileName, endTime, outputFileName, timeDuration);
            
        };

        const trimmedAudioBuffer = await trimAudio(audioStream, endTime);

        // Call the OpenAI Whisper API to transcribe the audio file
        const formData = new FormData();
        formData.append('file', trimmedAudioBuffer, { filename: 'audio.mp3', contentType: audioFile.mimetype });
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'json');
        console.log("formData:", formData);

        const config = {
            headers: {
                "Content-Type": `multipart/form-data; charset=UTF-8; boundary=${formData._boundary}`,
                "Authorization": `Bearer ${process.env.REACT_APP_API_KEY}`,
            },
        };

        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, config);
        const transcription = response.data.text;


        res.json({ transcription });
    } catch (error) {
        res.status(500).json({ error: 'Error transcribing audio' })
        console.log(error);
    }
});

app.post('/api/transcribe_whisperai', async (req, res) => {
    const model = "whisper-1";
    const response_format = "text";
    const initial_prompt = "Hello, welcome to my lecture.\nMy name is Jamie.\nIt is nice to see everyone here today.\n";
    const verbose = true;
    // const form_data = {
    //     'model': model,
    //     'file': req.body.file,
    //     'response_format': response_format,
    //     'initial_prompt': initial_prompt,
    //     'verbose': verbose
    // };
    // const formData = new FormData()
    // formData.append("model", model);
    // console.log("hi");
    // formData.append("file", req.files.file);
    // formData.append("response_format", response_format);
    // formData.append("initial_prompt", initial_prompt);
    // formData.append("verbose", verbose);
    // console.log('req.files:', req.files);
    // console.log('req.body:', req.body);
    
    const whisper_url = 'https://api.openai.com/v1/audio/transcriptions';

    try{
        console.log('1');
        // const response = await axios.post(whisper_url, form_data, {
        //     headers: {
        //         "Content-Type": "multipart/form-data",
        //         Authorization: `Bearer ${process.env.REACT_APP_API_KEY}`,
        //     },
        // });

        await axios
            .post(whisper_url, req.files.file, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    Authorization: `Bearer ${process.env.REACT_APP_API_KEY}`,
                },
            })
            .then((res) => {
                console.log('2');
                console.log(res.data);
                return res.json(res.data);
                // setResponse(res.data);
                // setAnalysisLoaded(false);
                // setScriptLoaded(true);
                // getAnalysisType(res, topic);
            })
            .catch((err) => {
                console.log('3');
                console.log(err)
                // setScriptLoaded(true);
            });
    } catch (error) {
        throw error;
    }
});

app.post('/api/auth/google', async (req, res) => {
    const { code } = req.body;
    const client_id = googleOAuthCliendId;
    const client_secret = googleOAuthClientSecret;
    const redirect_url = 'http://localhost:3000';
    const grant_type = 'authorization_code';

    fetch('<https://oauth2.googleapis.com/token>', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            code,
            client_id,
            client_secret,
            redirect_url,
            grand_type,
        }),
    })
    .then(response => response.json())
    .then(tokens => {
        res.json(tokens);
        console.log("google login success yay.")
    })
    .catch(error => {
        console.error('Token exchange error:', error);
        res.status(500).json({
            error: 'Internal Server Error'
        });
    });
});

const PORT = process.env.PORT || 8080;
const MONGOOSE_URL = 'mongodb://localhost:27017/WAVLANG'

// mongoose.set('useNewUrlParser', true);
mongoose.set("strictQuery", false);
mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true})
.then(() => {
    app.listen(process.env.PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    })
})
.catch((error) => {
    console.log(error);
});

// mongoose.createConnection(MONGOOSE_URL, {useNewUrlParser: true})
// .then(() => app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`)
// }))
// .catch(err=> {
//     console.log(err);
// })

// app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });