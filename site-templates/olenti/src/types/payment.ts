export type PaymentMethod = 'card' | 'paypal' | 'bank-transfer'

export interface Payment {
  id: string
  orderId: string
  amount: number
  method: PaymentMethod
  status: 'pending' | 'completed' | 'failed'
  createdAt: Date
}
