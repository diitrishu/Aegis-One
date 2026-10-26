/**
 * Toast Notification System
 * Production-grade user feedback for emergency operations
 * 
 * CRITICAL: Only displays real system events and data
 * No mock notifications or fake data
 */

class ToastNotification {
    constructor() {
        this.container = null;
        this.toasts = new Map();
        this.toastCounter = 0;
        this.init();
    }

    /**
     * Initialize toast container
     */
    init() {
        // Create container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            this.container.setAttribute('aria-live', 'polite');
            this.container.setAttribute('aria-atomic', 'true');
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    /**
     * Show success toast
     * @param {string} message - Success message
     * @param {number} duration - Auto-dismiss duration in ms (default: 5000)
     */
    success(message, duration = 5000) {
        return this.show({
            type: 'success',
            title: 'Success',
            message: message,
            duration: duration
        });
    }

    /**
     * Show warning toast
     * @param {string} message - Warning message
     * @param {number} duration - Auto-dismiss duration in ms (default: 7000)
     */
    warning(message, duration = 7000) {
        return this.show({
            type: 'warning',
            title: 'Warning',
            message: message,
            duration: duration
        });
    }

    /**
     * Show error toast
     * @param {string} message - Error message
     * @param {number} duration - Auto-dismiss duration in ms (default: 10000)
     */
    error(message, duration = 10000) {
        return this.show({
            type: 'error',
            title: 'Error',
            message: message,
            duration: duration
        });
    }

    /**
     * Show info toast
     * @param {string} message - Info message
     * @param {number} duration - Auto-dismiss duration in ms (default: 5000)
     */
    info(message, duration = 5000) {
        return this.show({
            type: 'info',
            title: 'Information',
            message: message,
            duration: duration
        });
    }

    /**
     * Show toast notification
     * @param {Object} options - Toast options
     */
    show(options) {
        const {
            type = 'info',
            title = 'Notification',
            message = '',
            duration = 5000
        } = options;

        const toastId = `toast-${++this.toastCounter}`;
        
        // Create toast element
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        
        // Get icon based on type
        const icon = this.getIcon(type);
        
        // Build toast HTML
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <div class="toast-title">${this.escapeHtml(title)}</div>
                <div class="toast-message">${this.escapeHtml(message)}</div>
            </div>
            <button class="toast-close" aria-label="Close notification">×</button>
        `;
        
        // Add to container
        this.container.appendChild(toast);
        
        // Setup close button
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.dismiss(toastId));
        
        // Store toast reference
        this.toasts.set(toastId, {
            element: toast,
            timer: null
        });
        
        // Auto-dismiss if duration is set
        if (duration > 0) {
            const timer = setTimeout(() => {
                this.dismiss(toastId);
            }, duration);
            
            this.toasts.get(toastId).timer = timer;
        }
        
        return toastId;
    }

    /**
     * Dismiss a toast
     * @param {string} toastId - Toast ID to dismiss
     */
    dismiss(toastId) {
        const toastData = this.toasts.get(toastId);
        if (!toastData) return;
        
        const { element, timer } = toastData;
        
        // Clear timer if exists
        if (timer) {
            clearTimeout(timer);
        }
        
        // Fade out animation
        element.style.animation = 'slideOut 250ms ease-in forwards';
        
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            this.toasts.delete(toastId);
        }, 250);
    }

    /**
     * Dismiss all toasts
     */
    dismissAll() {
        const toastIds = Array.from(this.toasts.keys());
        toastIds.forEach(id => this.dismiss(id));
    }

    /**
     * Get icon for toast type
     * @param {string} type - Toast type
     * @returns {string} Icon HTML
     */
    getIcon(type) {
        const icons = {
            success: '<i class="fas fa-check-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            error: '<i class="fas fa-times-circle"></i>',
            info: '<i class="fas fa-info-circle"></i>'
        };
        return icons[type] || icons.info;
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Add slideOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Create global instance
window.toast = new ToastNotification();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToastNotification;
}
