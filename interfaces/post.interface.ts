export interface IPostData {
  username: string;
  title: string;
  content: string;
  created_at: Date;
  updated_at: Date;
  upvotes: number;
  downvotes: number;
  upvoters?: { [username: string]: boolean };
  downvoters?: { [username: string]: boolean };
}
