import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface User {
  email: string;
  role: 'admin' | 'client';
}

export interface Raffle {
  id: number;
  name: string;
  description: string;
  price: number;
  total_numbers: number;
  end_date: string;
  image_url: string;
  profit_percent: number;
  active: number;
  created_at: string;
}

export interface RaffleNumber {
  id: number;
  raffle_id: number;
  number: number;
  status: 'available' | 'reserved' | 'sold';
  buyer_name?: string;
  buyer_whatsapp?: string;
  buyer_instagram?: string;
}

export interface DrawResult {
  id: number;
  raffle_id: number;
  winning_number: number;
  winner_name: string;
  winner_whatsapp: string;
  draw_date: string;
}
