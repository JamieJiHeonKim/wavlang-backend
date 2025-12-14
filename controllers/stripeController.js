const express = require('express');
const Stripe = require('stripe');
const router = express.Router()
require("dotenv").config();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const createPaymentIntent = async (req, res, next) => {
    try {
        const { amount, billingDetails } = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            ...(billingDetails && { billing_details: billingDetails })
        });

        res.status(200).send({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        res.status(500).send({
            error: error.message
        });
    }
}

const makePayment = async (req, res, next) => {
    const { amount, currency } = req.body;

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency,
            metadata: {
                integration_check: 'accept_a_payment'
            },
        });
        res.json({
            clientSecret: paymentIntent.client_secret
        });
    } catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
};

const payment = async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            line_items: req.body.items.map(item => {
                return {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: item.name,
                        },
                        unit_amount: item.price * 100,
                    },
                    quantity: item.quantity,
                }
            }),
            success_url: `${process.env.CLIENT_URL}`,
            cancel_url: `${process.env.CLIENT_URL}`
        })
        res.json({
            url: session.url
        })
    } catch (err) {
        res.status(500).json({
            error: err.message
        })
    }
};

module.exports = {
    makePayment,
    payment,
    createPaymentIntent
}