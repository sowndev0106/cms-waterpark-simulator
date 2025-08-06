/**
 * subcriber router
 */
export default {
    routes: [
        {
            method: 'POST',
            path: '/subscribers/subscribe',
            handler: 'subcriber.subscribe',
            config: {
                auth: false, // Cho phép truy cập công khai
            },
        },
        {
            method: 'GET',
            path: '/subscribers/confirm',
            handler: 'subcriber.confirm',
            config: {
                auth: false,
            },
        },
        {
            method: 'GET',
            path: '/subscribers/unsubscribe',
            handler: 'subcriber.unsubscribe',
            config: {
                auth: false,
            },
        },
        // Bạn có thể giữ lại các routes mặc định nếu cần
        // hoặc xóa chúng đi nếu chỉ sử dụng các custom routes trên.
        {
            method: 'GET',
            path: '/subcribers',
            handler: 'subcriber.find',
        },
        {
            method: 'GET',
            path: '/subcribers/:id',
            handler: 'subcriber.findOne',
        },
        {
            method: 'POST',
            path: '/subcribers',
            handler: 'subcriber.create',
        },
        {
            method: 'PUT',
            path: '/subcribers/:id',
            handler: 'subcriber.update',
        },
        {
            method: 'DELETE',
            path: '/subcribers/:id',
            handler: 'subcriber.delete',
        },
    ],
};
