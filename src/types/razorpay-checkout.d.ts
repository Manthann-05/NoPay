export {};

declare global {
  interface RazorpayCheckoutResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }

  interface RazorpayCheckoutOptions {
    key: string;
    order_id: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    prefill?: { name: string; email: string; contact: string };
    config?: {
      display: {
        blocks: Record<
          string,
          {
            name: string;
            instruments: { method: string }[];
          }
        >;
        sequence: string[];
        preferences: { show_default_blocks: boolean };
      };
    };
    handler: (response: RazorpayCheckoutResponse) => void;
    modal: { ondismiss: () => void };
  }

  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open(): void };
  }
}
