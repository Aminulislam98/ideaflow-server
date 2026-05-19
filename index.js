const express = require("express");
const app = express();

const cors = require("cors");
// required dot env for connecting the dot env
const dotenv = require("dotenv");
dotenv.config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { jwtVerify, createRemoteJWKSet } = require("jose-cjs");
const uri = process.env.MONGODB_URI;
const PORT = process.env.PORT || 4000;

// use cors help to connecting 2 url into protocol
app.use(cors());
// using express json giving access to transfer json data
app.use(express.json());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(new URL("http://localhost:3000/api/auth/jwks"));

const verifyToken = async (req, res, next) => {
  const tokenHeader = req?.headers?.authorization;
  if (!tokenHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = tokenHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const { payload } = await jwtVerify(token, JWKS);
    console.log("this is payload:", payload);
    return next();
  } catch (error) {
    res.status(403).json({ message: "Forbidden" });
  }
};
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("ideaflow");
    const ideaCollection = db.collection("ideas");
    // Send a ping to confirm a successful connection

    // getting trending ideas
    app.get("/ideas/trending", async (req, res) => {
      const result = await ideaCollection
        .find()
        .sort({ likeCount: -1 })
        .limit(6)
        .toArray();
      res.json(result);
    });

    app.get("/ideas/suggestions", async (req, res) => {
      try {
        const { search } = req.query;
        const suggestions = await ideaCollection
          .find({
            title: { $regex: search, $options: "i" },
          })
          .project({ title: 1, _id: 1 })
          .limit(5)
          .toArray();
        res.json(suggestions);
      } catch (err) {
        res.status(500).json({ message: "Server error" });
      }
    });

    // getting ideas ny query
    app.get("/ideas", async (req, res) => {
      try {
        const { search, category, sort } = req.query;
        console.log("Sort received:", sort); // Let's check this!
        console.log("category received:", category); // Let's check this!

        const query = {};
        if (search) {
          query.title = { $regex: search, $options: "i" };
        }
        if (category && category !== "All Categories") {
          query.category = category;
        }
        const sortOrder = sort === "Oldest" ? 1 : -1;
        console.log(req?.query?.sort);
        const ideas = await ideaCollection
          .find(query)
          .sort({ createdAt: sortOrder })
          .toArray();
        res.json(ideas);
      } catch (err) {
        res.status(500).json({ message: "Server Error" });
      }
    });

    // getting idea details page
    app.get("/ideas/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await ideaCollection.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    // adding idea
    app.post("/idea", async (req, res) => {
      const ideaData = req.body;
      const result = await ideaCollection.insertOne(ideaData);
      res.json(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.get("/", async (req, res) => {
  res.send("server is running properly!");
});
app.listen(PORT, () => {
  console.log("server is running for ideaFlow!");
});
