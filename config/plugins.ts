export default ({ env }) => ({
    // Email plugin configuration
    email: {
        config: {
            provider: '@strapi/provider-email-sendgrid',
            providerOptions: {
            },
            settings: {
                defaultFrom: env('EMAIL_FROM', 'noreply@waterpark-simulator.com'),
                defaultReplyTo: env('EMAIL_REPLY_TO', 'noreply@waterpark-simulator.com'),
                testAddress: env('EMAIL_TEST_ADDRESS'), // Optional: for testing
            },
        },
    },

    // Users & Permissions plugin (nếu cần custom)
    'users-permissions': {
        config: {
            // Email templates sẽ được cấu hình qua admin panel
            email: {
                from: env('EMAIL_FROM', 'noreply@waterpark-simulator.com'),
                replyTo: env('EMAIL_REPLY_TO', 'noreply@waterpark-simulator.com'),
            },
        },
    },

    // Nếu bạn muốn sử dụng provider khác (optional)
    // Uncomment phần dưới và cấu hình provider bạn muốn

    // // SendGrid
    // email: {
    //   config: {
    //     provider: 'sendgrid',
    //     providerOptions: {
    //       apiKey: env('SENDGRID_API_KEY'),
    //     },
    //     settings: {
    //       defaultFrom: env('EMAIL_FROM'),
    //       defaultReplyTo: env('EMAIL_REPLY_TO'),
    //     },
    //   },
    // },

    // // Mailgun
    // email: {
    //   config: {
    //     provider: 'mailgun',
    //     providerOptions: {
    //       key: env('MAILGUN_API_KEY'),
    //       domain: env('MAILGUN_DOMAIN'),
    //       url: env('MAILGUN_URL', 'https://api.mailgun.net'), // Optional
    //     },
    //     settings: {
    //       defaultFrom: env('EMAIL_FROM'),
    //       defaultReplyTo: env('EMAIL_REPLY_TO'),
    //     },
    //   },
    // },

    // // AWS SES
    // email: {
    //   config: {
    //     provider: 'amazon-ses',
    //     providerOptions: {
    //       key: env('AWS_SES_KEY'),
    //       secret: env('AWS_SES_SECRET'),
    //       amazon: env('AWS_SES_REGION', 'us-east-1'),
    //     },
    //     settings: {
    //       defaultFrom: env('EMAIL_FROM'),
    //       defaultReplyTo: env('EMAIL_REPLY_TO'),
    //     },
    //   },
    // },

    // // Gmail/Google
    // email: {
    //   config: {
    //     provider: 'nodemailer',
    //     providerOptions: {
    //       host: 'smtp.gmail.com',
    //       port: 587,
    //       auth: {
    //         user: env('GMAIL_USERNAME'),
    //         pass: env('GMAIL_PASSWORD'), // Use App Password, not regular password
    //       },
    //     },
    //     settings: {
    //       defaultFrom: env('EMAIL_FROM'),
    //       defaultReplyTo: env('EMAIL_REPLY_TO'),
    //     },
    //   },
    // },
});