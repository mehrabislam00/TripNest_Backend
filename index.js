import express from "express";
import { MongoClient } from "mongodb";
const app = express();
const port = process.env.PORT || 5000;

const client = new MongoClient(
  `mongodb://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@ac-ppqagur-shard-00-00.xljrgl3.mongodb.net:27017,ac-ppqagur-shard-00-01.xljrgl3.mongodb.net:27017,ac-ppqagur-shard-00-02.xljrgl3.mongodb.net:27017/?ssl=true&replicaSet=atlas-14m6wj-shard-0&authSource=admin`,
);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}


const ConnectedClient = await connectToMongoDB();
const db = ConnectedClient.db("TripNest_DB");
const usersCollection = db.collection("users");   

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
