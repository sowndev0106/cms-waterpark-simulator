import crypto from 'crypto';

export default ({ strapi }) => ({
    /**
     * Gửi email xác nhận đăng ký.
     * @param {object} subscriber - Đối tượng người đăng ký.
     */
    async sendConfirmationEmail(subscriber) {
        const { email, confirmationToken } = subscriber;
        const frontendUrl = process.env.FRONTEND_URL;

        if (!frontendUrl) {
            strapi.log.error("FRONTEND_URL is not set in the environment variables.");
            return;
        }

        const confirmationLink = `${frontendUrl}/subscribers/confirmation?token=${confirmationToken}`;
        const unsubscribeLink = `${frontendUrl}/subscribers/unsubscribe?email=${encodeURIComponent(email)}`;

        try {
            // Strapi 5 sử dụng plugin email khác
            const emailService = strapi.plugin('email')?.service?.('email') || strapi.service('plugin::email.email');

            if (!emailService) {
                strapi.log.error('Email service not available. Make sure email plugin is installed and configured.');
                return;
            }

            await emailService.send({
                to: email,
                from: process.env.EMAIL_FROM,
                replyTo: process.env.EMAIL_REPLY_TO,
                subject: 'Xác nhận đăng ký nhận bản tin',
                html: `
                    <h1>Chào mừng bạn!</h1>
                    <p>Cảm ơn bạn đã đăng ký nhận bản tin của chúng tôi. Vui lòng nhấp vào liên kết bên dưới để xác nhận địa chỉ email của bạn:</p>
                    <a href="${confirmationLink}" target="_blank" style="background-color: #007cba; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Xác nhận đăng ký</a>
                    <p>Liên kết này sẽ hết hạn sau ${process.env.CONFIRMATION_TOKEN_EXPIRES_DAYS || 7} ngày.</p>
                    <hr>
                    <p>Nếu bạn không yêu cầu đăng ký này, vui lòng bỏ qua email này.</p>
                    <p>Để hủy đăng ký trong tương lai, bạn có thể truy cập: <a href="${unsubscribeLink}">hủy đăng ký</a>.</p>
                `,
            });
            strapi.log.info(`Confirmation email sent to ${email}`);
        } catch (err) {
            strapi.log.error(`Failed to send confirmation email to ${email}`, err);
            throw err; // Re-throw để controller có thể xử lý
        }
    },

    /**
     * Tạo một token ngẫu nhiên và an toàn.
     * @returns {string} Token.
     */
    generateToken() {
        return crypto.randomBytes(32).toString('hex');
    },

    /**
     * Kiểm tra email service có sẵn không
     * @returns {boolean}
     */
    isEmailServiceAvailable() {
        try {
            const emailService = strapi.plugin('email')?.service?.('email') || strapi.service('plugin::email.email');
            return !!emailService;
        } catch (error) {
            return false;
        }
    }
});