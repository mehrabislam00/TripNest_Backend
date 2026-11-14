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
const authDb = ConnectedClient.db("auth");
const destinationsCollection = db.collection("destinations");
const authUsersCollection = authDb.collection("user");
const userProfilesCollection = db.collection("userProfiles");
const bookingsCollection = db.collection("bookings");

function userFilter(id) {
  const filters = [{ _id: id }];
  if (ObjectId.isValid(id)) filters.push({ _id: new ObjectId(id) });
  return filters.length === 1 ? filters[0] : { $or: filters };
}

// GET / - Health check for the API.
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// GET /destinations - Return all destinations.
app.get("/destinations", async (req, res) => {
  const cursor = destinationsCollection.find({});
  const destinations = await cursor.toArray();
  res.send(destinations);
});

// GET /destinations/:id - Return one destination by MongoDB ID.
app.get("/destinations/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const destination = await destinationsCollection.findOne(query);
  res.send(destination);
});

// PATCH /destinations/:id - Update a destination by MongoDB ID.
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

// DELETE /destinations/:id - Delete a destination by MongoDB ID.
app.delete("/destinations/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await destinationsCollection.deleteOne(query);
  res.send(result);
});


// POST /add_destination - Create a new destination.
app.post("/add_destination", async (req, res) => {
  const destination = req.body;
  const result = await destinationsCollection.insertOne(destination);
  res.send(result);
});

// GET /user/:id - Return auth data merged with optional profile data.
app.get("/user/:id", async (req, res) => {
  const id = req.params.id;
  const user = await authUsersCollection.findOne(userFilter(id));

  if (!user) {
    return res.status(404).send({ error: "User not found" });
  }

  const profile = await userProfilesCollection.findOne(
    { userId: id },
    { projection: { _id: 0 } },
  );
  const { password: _password, ...safeUser } = user;

  res.send({ ...safeUser, ...profile, id });
});

// PATCH /user/:id - Update auth fields and upsert profile fields separately.
app.patch("/user/:id", async (req, res) => {
  const id = req.params.id;
  const body = req.body ?? {};
  const authUpdate = {};
  const profileUpdate = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return res.status(400).send({ error: "Name must be a non-empty string" });
    }
    authUpdate.name = body.name.trim();
  }

  if (body.email !== undefined) {
    if (
      typeof body.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
    ) {
      return res.status(400).send({ error: "A valid email is required" });
    }
    authUpdate.email = body.email.trim().toLowerCase();
  }

  for (const field of ["phone", "address", "avatar"]) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== "string") {
        return res.status(400).send({ error: `${field} must be a string` });
      }
      profileUpdate[field] = body[field].trim();
    }
  }

  if (body.password !== undefined) {
    return res.status(400).send({
      error: "Password changes must use the authentication system",
    });
  }

  if (!Object.keys(authUpdate).length && !Object.keys(profileUpdate).length) {
    return res.status(400).send({ error: "No profile fields were provided" });
  }

  const user = await authUsersCollection.findOne(userFilter(id), {
    projection: { _id: 1 },
  });
  if (!user) {
    return res.status(404).send({ error: "User not found" });
  }

  try {
    if (Object.keys(authUpdate).length) {
      await authUsersCollection.updateOne(userFilter(id), {
        $set: { ...authUpdate, updatedAt: new Date() },
      });
    }

    if (Object.keys(profileUpdate).length) {
      await userProfilesCollection.updateOne(
        { userId: id },
        {
          $set: { ...profileUpdate, updatedAt: new Date() },
          $setOnInsert: { userId: id, createdAt: new Date() },
        },
        { upsert: true },
      );
    }

    res.send({ success: true });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).send({ error: "That email is already in use" });
    }
    console.error("Failed to update user profile:", error);
    res.status(500).send({ error: "Failed to update user profile" });
  }
});


// GET /bookings - Return bookings filtered by userId or email.
app.get("/bookings", async (req, res) => {
  const filter =
    typeof req.query.userId === "string"
      ? { userId: req.query.userId }
      : typeof req.query.email === "string"
        ? { email: req.query.email }
        : {};

  try {
    const bookings = await bookingsCollection.find(filter).toArray();
    res.send(bookings);
  } catch (error) {
    console.error("Failed to load bookings:", error);
    res.status(500).send({ error: "Failed to load bookings" });
  }
});

// POST /bookings - Create a booking document.
app.post("/bookings", async (req, res) => {
  const booking = req.body;
  try {
    const result = await bookingsCollection.insertOne(booking);
    res.send(result);
  } catch (error) {
    console.error("Failed to create booking:", error);
    res.status(500).send({ error: "Failed to create booking" });
  }
});

// PATCH /bookings/:id - Update a booking status by MongoDB ID.
app.patch("/bookings/:id", async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ error: "Invalid booking id" });
  }

  try {
    const result = await bookingsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: req.body?.status, updatedAt: new Date() } },
    );

    if (!result.matchedCount) {
      return res.status(404).send({ error: "Booking not found" });
    }

    res.send({ success: true });
  } catch (error) {
    console.error("Failed to update booking:", error);
    res.status(500).send({ error: "Failed to update booking" });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
