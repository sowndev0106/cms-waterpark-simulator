import crypto from 'crypto';

export default ({ strapi }) => ({
    /**
     * Gửi email xác nhận đăng ký sử dụng template từ Strapi.
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
            // Lấy email template từ Strapi
            const emailTemplate = await this.getEmailTemplate('confirmation', {
                USER: subscriber.name || email.split('@')[0], // Tên người dùng
                EMAIL: email,
                URL: confirmationLink,
                UNSUBSCRIBE_URL: unsubscribeLink,
                DAYS: process.env.CONFIRMATION_TOKEN_EXPIRES_DAYS || 7
            });

            const emailService = strapi.plugin('email')?.service?.('email') || strapi.service('plugin::email.email');

            if (!emailService) {
                strapi.log.error('Email service not available. Make sure email plugin is installed and configured.');
                return;
            }

            await emailService.send({
                to: email,
                from: process.env.EMAIL_FROM,
                replyTo: process.env.EMAIL_REPLY_TO,
                subject: emailTemplate.subject,
                html: emailTemplate.html,
                text: emailTemplate.text, // Plain text version
            });

            strapi.log.info(`Confirmation email sent to ${email}`);
        } catch (err) {
            strapi.log.error(`Failed to send confirmation email to ${email}`, err);
            throw err;
        }
    },

    /**
     * Lấy email template từ Strapi và thay thế placeholder
     * @param {string} templateName - Tên template
     * @param {object} variables - Biến để thay thế trong template
     * @returns {object} Template đã được xử lý
     */
    async getEmailTemplate(templateName, variables = {}) {
        try {
            // Cách 1: Sử dụng Users & Permissions plugin template
            const pluginStore = strapi.store({
                type: 'plugin',
                name: 'users-permissions',
            });


            let template;
            // Lấy template dựa vào templateName
            switch (templateName) {
                case 'confirmation':
                    const emailSettings = await pluginStore.get({ key: 'email' });
                    template = emailSettings['email_confirmation']
                    break;
                default:
                    // Fallback template
                    template = {
                        subject: 'Xác nhận đăng ký',
                        message: `
                            <h1>Xin chào <%= USER %>!</h1>
                            <p>Cảm ơn bạn đã đăng ký. Vui lòng xác nhận email bằng cách nhấp vào liên kết:</p>
                            <a href="<%= URL %>">Xác nhận đăng ký</a>
                            <p>Liên kết hết hạn sau <%= DAYS %> ngày.</p>
                            <p><a href="<%= UNSUBSCRIBE_URL %>">Hủy đăng ký</a></p>
                        `
                    };
            }
            const processedTemplate = this.replaceTemplateVariables(template, variables);
            return {
                subject: processedTemplate.subject,
                html: processedTemplate.message,
                from: processedTemplate.from,
                replyTo: processedTemplate.replyTo,
                text: this.htmlToText(processedTemplate.message)
            };

        } catch (error) {
            strapi.log.error('Error getting email template:', error);

            // Fallback template nếu không lấy được từ Strapi
            return this.getFallbackTemplate(templateName, variables);
        }
    },

    /**
     * Thay thế các placeholder trong template
     * @param {object} template - Template object
     * @param {object} variables - Variables to replace
     * @returns {object} Processed template
     */
    replaceTemplateVariables(template, variables) {
        let subject = template.options.subject || '';
        let message = template.options.message || '';
        const from = template.options?.from?.email || process.env.EMAIL_FROM;
        const replyTo = template.options?.['response_email'] || process.env.EMAIL_REPLY_TO;
        // Thay thế các placeholder
        Object.keys(variables).forEach(key => {
            const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            subject = subject.replace(placeholder, variables[key]);
            message = message.replace(placeholder, variables[key]);
        });

        return { subject, message, from, replyTo };
    },

    /**
     * Chuyển HTML thành plain text
     * @param {string} html 
     * @returns {string}
     */
    htmlToText(html) {
        return html
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();
    },

    /**
     * Template dự phòng nếu không lấy được từ Strapi
     * @param {string} templateName 
     * @param {object} variables 
     * @returns {object}
     */
    getFallbackTemplate(templateName, variables) {
        const templates = {
            confirmation: {
                subject: 'Xác nhận đăng ký nhận bản tin',
                html: `
                    <h1>Chào mừng ${variables.USER || 'bạn'}!</h1>
                    <p>Cảm ơn bạn đã đăng ký nhận bản tin của chúng tôi. Vui lòng nhấp vào liên kết bên dưới để xác nhận địa chỉ email của bạn:</p>
                    <a href="${variables.URL}" target="_blank" style="background-color: #007cba; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Xác nhận đăng ký</a>
                    <p>Liên kết này sẽ hết hạn sau ${variables.DAYS} ngày.</p>
                    <hr>
                    <p>Nếu bạn không yêu cầu đăng ký này, vui lòng bỏ qua email này.</p>
                    <p>Để hủy đăng ký trong tương lai, bạn có thể truy cập: <a href="${variables.UNSUBSCRIBE_URL}">hủy đăng ký</a>.</p>
                `
            }
        };

        const template = templates[templateName] || templates.confirmation;

        return {
            subject: template.subject,
            html: template.html,
            text: this.htmlToText(template.html)
        };
    },

    /**
     * Cập nhật email template trong Strapi
     * @param {string} templateName 
     * @param {object} templateData 
     */
    async updateEmailTemplate(templateName, templateData) {
        try {
            const pluginStore = strapi.store({
                type: 'plugin',
                name: 'users-permissions',
            });

            let key;
            switch (templateName) {
                case 'confirmation':
                    key = 'email_confirmation';
                    break;
                case 'reset-password':
                    key = 'email_reset_password';
                    break;
                default:
                    throw new Error(`Unknown template: ${templateName}`);
            }

            await pluginStore.set({
                key: key,
                value: templateData
            });

            strapi.log.info(`Email template ${templateName} updated successfully`);
        } catch (error) {
            strapi.log.error(`Failed to update email template ${templateName}:`, error);
            throw error;
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