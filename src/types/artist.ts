export type CRMStatus = 
  | 'Новый' 
  | 'Изучен' 
  | 'Написали' 
  | 'Ответил' 
  | 'Клиент' 
  | 'Не актуален' 
  | 'Избранное';

export interface CRMContactPerson {
  user_id?: number;
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
  link?: string;
}

export interface ArtistRecord {
  id: string;
  vk_id: string;
  name: string;
  link: string;
  description: string;
  followers: number;
  last_activity: string;
  music_links: string;
  contacts: string;
  avatar: string;
  raw_data: string;
  status: CRMStatus;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface HistoryRecord {
  id?: number;
  artist_id: string;
  record_type: string;
  content: string;
  created_at?: string;
}
