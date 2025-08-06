declare module '@strapi/strapi' {
    interface ContentTypes {
        'api::subcriber.subcriber': {
            attributes: {
                email: string;
                confirmationToken?: string;
                confirmationAt?: string;
                tokenExpiresAt?: string;
                subscribedAt?: string;
                unsubscribedAt?: string;
                subscriptionState: 'pending' | 'subscribed' | 'unsubscribed';
                source?: string;
            };
        };
    }
}

export { };