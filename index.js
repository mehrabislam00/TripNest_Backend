import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";

// Create an Express application
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

const username = process.env.MONGODB_USERNAME;
const password = process.env.MONGODB_PASSWORD;

// Check if username and password are provided
if (!username || !password) {
  throw new Error("MONGODB_USERNAME and MONGODB_PASSWORD must be configured");
}

const client = new MongoClient(
  `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@ac-ppqagur-shard-00-00.xljrgl3.mongodb.net:27017,ac-ppqagur-shard-00-01.xljrgl3.mongodb.net:27017,ac-ppqagur-shard-00-02.xljrgl3.mongodb.net:27017/?tls=true&replicaSet=atlas-14m6wj-shard-0&authSource=admin&retryWrites=true&w=majority`,
);

// Function to connect to MongoDB
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

// Connect to MongoDB and get the destinations collection
const ConnectedClient = await connectToMongoDB();
const db = ConnectedClient.db("TripNest_DB");
const destinationsCollection = db.collection("destinations");

//test route
app.get("/", (req, res) => {
  res.send("Hello World!");
});

//to get all destinations from the database
app.get("/destinations", async (req, res) => {
  const cursor = destinationsCollection.find({});
  const destinations = await cursor.toArray();
  res.send(destinations);
});

//to get a single destination by id from the database
app.get("/destinations/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const destination = await destinationsCollection.findOne(query);
  res.send(destination);
});

//update a destination by id
app.patch("/destinations/:id", async (req, res) => {
  const id = req.params.id;
  const updatedDestination = req.body;
  const filter = { _id: new ObjectId(id) };
  const options = { upsert: true };
  const updateDoc = {
    $set: {
      name: updatedDestination.name,
      country: updatedDestination.country,
      category: updatedDestination.category,
      price: updatedDestination.price,
      currency: updatedDestination.currency,
      description: updatedDestination.description,
      departureDate: updatedDestination.departureDate,
      duration: updatedDestination.duration,
      imageUrl: updatedDestination.imageUrl,
    },
  };
  const result = await destinationsCollection.updateOne(
    filter,
    updateDoc,
    options,
  );
  res.send(result);
});

//delete a destination by id
app.delete("/destinations/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await destinationsCollection.deleteOne(query);
  res.send(result);
});


//to add a new destination to the database
app.post("/add_destination", async (req, res) => {
  const destination = req.body;
  const result = await destinationsCollection.insertOne(destination);
  res.send(result);
});

//to get a single destination by id from the database
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
