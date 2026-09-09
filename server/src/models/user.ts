/**
 * Schema degli account. L'username e' unico perche' autore e proprietario sono nomi
 * senza ruolo; wallet e collezione appartengono ai profili che possono acquistare.
 */
import { Schema, model } from "mongoose";
import { User as SharedUser } from "../../../shared/types";

export interface IUser extends SharedUser {
  password: string;
}

const userSchema = new Schema<IUser>({
  username: { type: String, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["autore", "visitatore", "curatore"],
    required: true,
  },
  wallet: { type: Number },
  collezione: { type: [String], default: [] },
});

userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ collezione: 1 });

export const UserModel = model<IUser>("User", userSchema);
