// Row shapes for the bit schema (humor-hello-world/supabase/migrations).

export type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
  created_at: string;
};

export type ImageRow = {
  id: number;
  url: string;
  description: string | null;
  is_library: boolean;
  profile_id: string | null;
  created_at: string;
};

export type CaptionRow = {
  id: number;
  image_id: number;
  content: string;
  is_public: boolean;
  like_count: number;
  profile_id: string | null;
  caption_request_id: number | null;
  created_at: string;
};

export type VoteRow = {
  id: number;
  caption_id: number;
  profile_id: string;
  vote_value: number;
  created_at: string;
};
