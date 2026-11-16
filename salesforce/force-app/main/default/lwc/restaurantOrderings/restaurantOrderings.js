import { LightningElement } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import createPaymentLink
    from '@salesforce/apex/RestaurantPaymentController.createPaymentLink';

export default class RestaurantOrderings extends NavigationMixin(
    LightningElement
) {

    categories = [
        'All',
        'Breakfast',
        'Starters',
        'Main Course',
        'Beverages',
        'Desserts'
    ];

    selectedCategory = 'All';

    isPaying = false;

    // Sample menu data for initial Record Page testing.
    menuItems = [
        {
            id: 'ITEM001',
            name: 'Masala Dosa',
            category: 'Breakfast',
            description: 'Crispy dosa with potato masala',
            price: 90,
            emoji: '🥞'
        },
        {
            id: 'ITEM002',
            name: 'Idli Sambar',
            category: 'Breakfast',
            description: 'Soft idli with hot sambar',
            price: 60,
            emoji: '🍘'
        },
        {
            id: 'ITEM003',
            name: 'Paneer Tikka',
            category: 'Starters',
            description: 'Grilled paneer with spices',
            price: 180,
            emoji: '🍢'
        },
        {
            id: 'ITEM004',
            name: 'Veg Biryani',
            category: 'Main Course',
            description: 'Aromatic vegetable biryani',
            price: 160,
            emoji: '🍛'
        },
        {
            id: 'ITEM005',
            name: 'Fresh Lime Juice',
            category: 'Beverages',
            description: 'Fresh lime juice',
            price: 50,
            emoji: '🍹'
        },
        {
            id: 'ITEM006',
            name: 'Gulab Jamun',
            category: 'Desserts',
            description: 'Sweet gulab jamun',
            price: 70,
            emoji: '🍮'
        }
    ];

    cart = [];

    get filteredItems() {
        if (this.selectedCategory === 'All') {
            return this.menuItems;
        }

        return this.menuItems.filter(
            item => item.category === this.selectedCategory
        );
    }

    get cartTotal() {
        return this.cart.reduce(
            (total, item) => total + item.price * item.quantity,
            0
        );
    }

    get hasCart() {
        return this.cart.length > 0;
    }

    handleCategory(event) {
        this.selectedCategory =
            event.currentTarget.dataset.category;
    }

    handleAddToCart(event) {
        const itemId = event.currentTarget.dataset.id;

        const existing = this.cart.find(
            item => item.id === itemId
        );

        if (existing) {
            this.cart = this.cart.map(item =>
                item.id === itemId
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            );
        } else {
            const selected = this.menuItems.find(
                item => item.id === itemId
            );

            this.cart = [
                ...this.cart,
                { ...selected, quantity: 1 }
            ];
        }

        this.showToast(
            'Added',
            'Item added to cart',
            'success'
        );
    }

    handleIncrease(event) {
        const id = event.currentTarget.dataset.id;

        this.cart = this.cart.map(item =>
            item.id === id
                ? { ...item, quantity: item.quantity + 1 }
                : item
        );
    }

    handleDecrease(event) {
        const id = event.currentTarget.dataset.id;

        this.cart = this.cart
            .map(item =>
                item.id === id
                    ? { ...item, quantity: item.quantity - 1 }
                    : item
            )
            .filter(item => item.quantity > 0);
    }

    handleRemove(event) {
        const id = event.currentTarget.dataset.id;

        this.cart = this.cart.filter(
            item => item.id !== id
        );
    }

    async handlePayment() {

        if (!this.cart.length || this.isPaying) {
            return;
        }

        this.isPaying = true;

        try {

            // Send only product IDs and quantities.
            // Backend must calculate the actual amount.

            const cartPayload = this.cart.map(item => ({
                itemId: item.id,
                quantity: item.quantity
            }));

            const checkoutUrl = await createPaymentLink({
                cartJson: JSON.stringify(cartPayload)
            });

            if (
                !checkoutUrl ||
                !checkoutUrl.startsWith('https://rzp.io/')
            ) {
                throw new Error(
                    'Invalid Razorpay checkout URL returned by server.'
                );
            }

            this[NavigationMixin.Navigate]({
                type: 'standard__webPage',
                attributes: {
                    url: checkoutUrl
                }
            });

        } catch (error) {

            this.showToast(
                'Payment Error',
                error.body?.message || error.message,
                'error'
            );

        } finally {
            this.isPaying = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}