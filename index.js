import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";


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

const JWKS = createRemoteJWKSet(
  new URL(
    process.env.AUTH_JWKS_URL ?? `${process.env.CLIENT_URI}/api/auth/jwks`,
  ),
);

// Middleware to verify the JWT from the authorization header.
const verifyUserId = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const [scheme, token] = authHeader?.split(/\s+/) ?? [];
  if (!authHeader || scheme?.toLowerCase() !== "bearer" || !token) {
    return res
      .status(401)
      .send({ error: "A Bearer authorization token is required" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("Token verification failed:", error.code ?? error.message);
    return res.status(401).send({ error: "Invalid or expired token" });
  }
};

// Utility function to create a filter for user queries

function userFilter(id) {
  const filters = [{ _id: id }];
  if (ObjectId.isValid(id)) filters.push({ _id: new ObjectId(id) });
  return filters.length === 1 ? filters[0] : { $or: filters };
}

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

// //update a destination by id
// app.patch("/destinations/:id", async (req, res) => {
//   const id = req.params.id;
//   const updatedDestination = req.body;
//   const filter = { _id: new ObjectId(id) };
//   const options = { upsert: true };
//   const updateDoc = {
//     $set: {
//       name: updatedDestination.name,
//       country: updatedDestination.country,
//       category: updatedDestination.category,
//       price: updatedDestination.price,
//       currency: updatedDestination.currency,
//       description: updatedDestination.description,
//       departureDate: updatedDestination.departureDate,
//       duration: updatedDestination.duration,
//       imageUrl: updatedDestination.imageUrl,
//     },
//   };
//   const result = await destinationsCollection.updateOne(
//     filter,
//     updateDoc,
//     options,
//   );
//   res.send(result);
// });

// //delete a destination by id
// app.delete("/destinations/:id", async (req, res) => {
//   const id = req.params.id;
//   const query = { _id: new ObjectId(id) };
//   const result = await destinationsCollection.deleteOne(query);
//   res.send(result);
// });


// //to add a new destination to the database
// app.post("/add_destination", async (req, res) => {
//   const destination = req.body;
//   const result = await destinationsCollection.insertOne(destination);
//   res.send(result);
// });

// Get authentication data with optional profile data.
app.get("/user/:id",  verifyUserId, async (req, res) => {
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

// Update authentication fields and upsert additional profile fields separately.
app.patch("/user/:id",  verifyUserId, async (req, res) => {
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


//bookings collection routes
app.get("/bookings", verifyUserId, async (req, res) => {
  const filter = {};
  if (typeof req.query.userId === "string" && req.query.userId.trim()) {
    filter.userId = req.query.userId.trim();
  }
  if (typeof req.query.email === "string" && req.query.email.trim()) {
    filter.email = req.query.email.trim().toLowerCase();
  }

  try {
    const bookings = await bookingsCollection.find(filter).toArray();
    res.send(bookings);
  } catch (error) {
    console.error("Failed to load bookings:", error);
    res.status(500).send({ error: "Failed to load bookings" });
  }
});


//to get a single booking by id from the database
app.post("/bookings", verifyUserId, async (req, res) => {
  const booking = req.body;
  try {
    const result = await bookingsCollection.insertOne(booking);
    res.send(result);
  } catch (error) {
    console.error("Failed to create booking:", error);
    res.status(500).send({ error: "Failed to create booking" });
  }
});

// Update booking status by id
app.patch("/bookings/:id", verifyUserId, async (req, res) => {
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

//to get a single destination by id from the database
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

export default app;
