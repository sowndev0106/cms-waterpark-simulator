/**
 * subscriber controller - Clean version for Strapi 5
 * Updated to use Google reCAPTCHA instead of Cloudflare Turnstile
 */

const { factories } = require('@strapi/strapi');

// Type definitions
interface RecaptchaResponse {
    success: boolean;
    challenge_ts?: string;
    hostname?: string;
    'error-codes'?: string[];
    score?: number; // For reCAPTCHA v3
    action?: string; // For reCAPTCHA v3
}

interface SubscriberData {
    email: string;
    subscriptionState: 'pending' | 'subscribed' | 'unsubscribed';
    confirmationToken?: string | null;
    tokenExpiresAt?: string | null;
    subscribedAt?: string | null;
    confirmationAt?: string | null;
    unsubscribedAt?: string | null;
}

module.exports = factories.createCoreController('api::subcriber.subcriber', ({ strapi }) => ({

    /**
     * API 1: Xử lý việc đăng ký mới.
     */
    async subscribe(ctx: any) {
        const { email, recaptchaToken } = ctx.request.body;

        // --- 1. Validate Input ---
        if (!email) {
            return ctx.badRequest('Email is required.', { errorCode: 'EMAIL_REQUIRED' });
        }
        if (!recaptchaToken) {
            return ctx.badRequest('Captcha validation is required.', { errorCode: 'CAPTCHA_REQUIRED' });
        }

        // --- 2. Verify Google reCAPTCHA ---
        const secretKey = process.env.GOOGLE_RECAPTCHA_SECRET_KEY;
        if (!secretKey) {
            strapi.log.error('GOOGLE_RECAPTCHA_SECRET_KEY is not configured');
            return ctx.internalServerError('Server configuration error.');
        }

        // Prepare form data for reCAPTCHA verification
        const formData = new URLSearchParams();
        formData.append('secret', secretKey);
        formData.append('response', recaptchaToken);

        // Optional: Add user's IP address for additional verification
        const userIP = ctx.request.ip || ctx.request.socket.remoteAddress;
        if (userIP) {
            formData.append('remoteip', userIP);
        }

        try {
            const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString(),
            });

            const result = await response.json() as RecaptchaResponse;

            if (!result.success) {
                strapi.log.warn('reCAPTCHA verification failed', {
                    errorCodes: result['error-codes'],
                    score: result.score,
                    action: result.action
                });
                return ctx.badRequest('Invalid captcha.', { errorCode: 'CAPTCHA_INVALID' });
            }

            // For reCAPTCHA v3: Check score threshold (optional)
            const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');
            if (result.score !== undefined && result.score < minScore) {
                strapi.log.warn('reCAPTCHA score too low', {
                    score: result.score,
                    threshold: minScore
                });
                return ctx.badRequest('Captcha verification failed.', { errorCode: 'CAPTCHA_SCORE_TOO_LOW' });
            }

        } catch (error) {
            strapi.log.error('Error verifying reCAPTCHA', error);
            return ctx.internalServerError('Could not verify captcha.', { errorCode: 'CAPTCHA_VERIFY_ERROR' });
        }

        // --- 3. Process Subscription Logic ---
        try {
            const customSubscriberService = strapi.service('api::subcriber.custom-subcriber');
            const contentType = 'api::subcriber.subcriber';

            const existingSubscriber = await strapi.db.query(contentType).findOne({
                where: { email }
            });

            // Case 1: Đã đăng ký và active
            if (existingSubscriber?.subscriptionState === 'subscribed') {
                return ctx.badRequest('This email is already subscribed.', { errorCode: 'EMAIL_ALREADY_SUBSCRIBED' });
            }

            // Case 2: Đang chờ xác nhận và chưa hết thời gian cooldown
            if (existingSubscriber?.subscriptionState === 'pending') {
                const cooldownMinutes = parseInt(process.env.SUBSCRIBE_COOLDOWN_MINUTES || '5', 10);
                const lastAttemptTime = new Date(existingSubscriber.updatedAt);
                const cooldownTime = new Date(lastAttemptTime.getTime() + cooldownMinutes * 60000);

                if (new Date() < cooldownTime) {
                    return ctx.badRequest(`Please wait ${cooldownMinutes} minutes before trying again.`, {
                        errorCode: 'PENDING_SUBSCRIPTION_COOL_DOWN'
                    });
                }
            }

            // Case 3: Đăng ký mới hoặc đăng ký lại
            const token = customSubscriberService.generateToken();
            const tokenExpiresDays = parseInt(process.env.CONFIRMATION_TOKEN_EXPIRES_DAYS || '7', 10);
            const tokenExpiresAt = new Date();
            tokenExpiresAt.setDate(tokenExpiresAt.getDate() + tokenExpiresDays);

            const entryData: SubscriberData = {
                email,
                subscriptionState: 'pending',
                confirmationToken: token,
                tokenExpiresAt: tokenExpiresAt.toISOString(),
                subscribedAt: new Date().toISOString(),
                confirmationAt: null,
                unsubscribedAt: null,
            };

            let entry;
            if (existingSubscriber) {
                entry = await strapi.entityService.update(contentType, existingSubscriber.id, {
                    data: entryData
                });
            } else {
                entry = await strapi.entityService.create(contentType, {
                    data: entryData
                });
            }

            // Gửi email xác nhận
            await customSubscriberService.sendConfirmationEmail(entry);

            return ctx.send({
                message: 'Subscription request received. Please check your email to confirm.'
            });

        } catch (error: any) {
            strapi.log.error('Subscription error:', error);

            // Xử lý lỗi unique constraint của DB
            const isDuplicateError =
                error.code === 'ER_DUP_ENTRY' ||
                error.code === '23505' ||
                error.message?.includes('UNIQUE constraint') ||
                error.message?.toLowerCase().includes('duplicate entry');

            if (isDuplicateError) {
                return ctx.badRequest('This email is already subscribed or pending confirmation.', {
                    errorCode: 'EMAIL_ALREADY_SUBSCRIBED'
                });
            }

            return ctx.internalServerError('An error occurred during the subscription process.');
        }
    },

    /**
     * API 2: Xác nhận đăng ký từ email.
     */
    async confirm(ctx: any) {
        const { token } = ctx.query;

        if (!token) {
            return ctx.badRequest('Confirmation token is missing.', { errorCode: 'TOKEN_MISSING' });
        }

        try {
            const contentType = 'api::subcriber.subcriber';
            const subscriber = await strapi.db.query(contentType).findOne({
                where: { confirmationToken: token as string },
            });

            if (!subscriber) {
                return ctx.badRequest('Invalid confirmation token.', { errorCode: 'TOKEN_INVALID' });
            }

            if (new Date(subscriber.tokenExpiresAt) < new Date()) {
                return ctx.badRequest('Confirmation token has expired.', { errorCode: 'TOKEN_EXPIRED' });
            }

            const now = new Date();
            await strapi.entityService.update(contentType, subscriber.id, {
                data: {
                    subscriptionState: 'subscribed',
                    confirmationAt: now.toISOString(),
                    subscribedAt: now.toISOString(),
                    confirmationToken: null,
                    tokenExpiresAt: null,
                },
            });

            return ctx.send({ message: 'Your subscription has been confirmed. Thank you!' });

        } catch (error) {
            strapi.log.error('Confirmation error:', error);
            return ctx.internalServerError('An error occurred during confirmation.');
        }
    },

    /**
     * API 3: Hủy đăng ký.
     */
    async unsubscribe(ctx: any) {
        const { email } = ctx.query;

        if (!email) {
            return ctx.badRequest('Email is required to unsubscribe.', { errorCode: 'EMAIL_REQUIRED' });
        }

        try {
            const contentType = 'api::subcriber.subcriber';
            const subscriber = await strapi.db.query(contentType).findOne({
                where: { email: email as string },
            });

            if (!subscriber) {
                // Trả về thành công ngay cả khi không tìm thấy email để tránh lộ thông tin
                return ctx.send({ message: 'If this email exists in our system, it has been unsubscribed.' });
            }

            if (['pending', 'subscribed'].includes(subscriber.subscriptionState)) {
                await strapi.entityService.update(contentType, subscriber.id, {
                    data: {
                        subscriptionState: 'unsubscribed',
                        unsubscribedAt: new Date().toISOString(),
                        confirmationToken: null,
                        tokenExpiresAt: null,
                    },
                });
            }

            return ctx.send({ message: 'You have been successfully unsubscribed.' });

        } catch (error) {
            strapi.log.error('Unsubscribe error:', error);
            return ctx.internalServerError('An error occurred during unsubscription.');
        }
    },
}));