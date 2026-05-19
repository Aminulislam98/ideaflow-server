const express = require("express");
const app = express();

const cors = require("cors");
// required dot env for connecting the dot env
const dotenv = require("dotenv");
dotenv.config();

const { MongoClient, ServerApiVersion } = require("mongodb");
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
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("ideaflow");
    const ideaCollection = db.collection("ideas");
    // Send a ping to confirm a successful connection

    app.post("/idea", async (req, res) => {
      const ideaData = req.body;
      const result = await ideaCollection.insertOne(ideaData);
      res.json(result);
    });

    app.get("/ideas", async (req, res) => {
      const result = await ideaCollection.find().toArray();
      res.json(result);
    });

    app.get("/ideas/trending", async (req, res) => {
      const result = await ideaCollection
        .find()
        .sort({ likeCount: -1 })
        .limit(6)
        .toArray();
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
