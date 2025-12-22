module.exports = {
    PORT: process.env.PORT || 3000,
    MONGODB_URL: process.env.MONGODB_URL_SB2 || 'your_new_mongodb_connection_string',
    JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret',
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'your_stripe_secret_key',
    EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'your_email_service',
    EMAIL_USER: process.env.EMAIL_USER || 'your_email_user',
    EMAIL_PASS: process.env.EMAIL_PASS || 'your_email_password',
    NODE_ENV: process.env.NODE_ENV || 'development',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY',
    GEMINI_ENDPOINT: process.env.GEMINI_ENDPOINT || 'https://api.gemini.com/v1/image',
    // Se true, richiede che campi sensibili (website/email) siano confermati da web-verification
    STRICT_AI_GROUNDING: process.env.STRICT_AI_GROUNDING || true,
};