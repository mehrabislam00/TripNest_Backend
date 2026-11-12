import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const username = process.env.MONGODB_USERNAME;
const password = process.env.MONGODB_PASSWORD;

if (!username || !password) {
  throw new Error("MONGODB_USERNAME and MONGODB_PASSWORD must be configured");
}

const client = new MongoClient(
  `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@ac-ppqagur-shard-00-00.xljrgl3.mongodb.net:27017,ac-ppqagur-shard-00-01.xljrgl3.mongodb.net:27017,ac-ppqagur-shard-00-02.xljrgl3.mongodb.net:27017/?tls=true&replicaSet=atlas-14m6wj-shard-0&authSource=admin&retryWrites=true&w=majority`,
);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    throw err;
  }
}


const ConnectedClient = await connectToMongoDB();
const db = ConnectedClient.db("TripNest_DB");
const usersCollection = db.collection("destinations");   

app.get("/", (req, res) => {
  res.send("Hello World!");
});



app.post("/add_destination", async (req, res) => {
  const destination = req.body;
  const result = await usersCollection.insertOne(destination);
  res.send(result);

})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
