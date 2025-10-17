import mongoose from "mongoose";

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  apiKey: { type: String, required: true, unique: true },
  perMinuteLimit: { type: Number, required: true },
  perDayLimit: { type: Number, required: true },
});

export default mongoose.model("Client", clientSchema);
