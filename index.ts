import express, { NextFunction, Request, Response } from "express";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import dotenv from "dotenv";
import { PostsController } from "./controllers/PostsController";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const app = express();
const PORT = process.env.PORT;

app.use(express.json());

app.use(PostsController.registerRouter(db));

app.use("*", (error: any, req: Request, res: Response, next: NextFunction) => {
  return res.status(error.statusCode).json(error);
});

app.listen(PORT, () => console.log(`App Is Running On Port ${PORT}`));
