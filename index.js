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
    // new data base for comments
    const commentCollection = db.collection("comments");

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
            title: { $regex: `(^|\\s)${search}`, $options: "i" },
          })
          .project({ title: 1, _id: 1, imageURL: 1 })
          .limit(5)
          .toArray();
        res.json(suggestions);
      } catch (err) {
        res.status(500).json({ message: "Server error" });
      }
    });

    // getting user ideas only
    app.get("/ideas/user/:userId", async (req, res) => {
      const { userId } = req.params;
      const result = await ideaCollection
        .find({ "author.userId": userId })
        .toArray();
      res.json(result);
    });

    // getting ideas ny query
    app.get("/ideas", async (req, res) => {
      console.log(req.query);
      try {
        const { search, category, sort } = req.query;
        const query = {};
        if (search) {
          query.title = { $regex: search, $options: "i" };
        }
        if (category && category !== "All Categories") {
          query.category = category;
        }
        const sortOrder = sort === "Oldest" ? 1 : -1;
        const ideas = await ideaCollection
          .find(query)
          .sort({ createdAt: sortOrder })
          .toArray();
        res.json(ideas);
      } catch (err) {
        res.status(500).json({ message: "Server Error" });
      }
    });

    // POST — comment করো
    app.post("/comment", async (req, res) => {
      try {
        const commentData = req.body;
        const result = await commentCollection.insertOne(commentData);
        res.status(201).json({ ...commentData, _id: result.insertedId });
      } catch (err) {
        res.status(500).json({ message: "Server Error" });
      }
    });

    // GET — idea-র সব comments আনো
    app.get("/comment/:ideaId", async (req, res) => {
      try {
        const { ideaId } = req.params;
        const comments = await commentCollection
          .find({ ideaId, parentId: null })
          .sort({ createdAt: -1 })
          .toArray();
        res.json(comments);
      } catch (err) {
        res.status(500).json({ message: "Server Error" });
      }
    });

    // PATCH — like toggle
    app.patch("/comment/:commentId/like", async (req, res) => {
      try {
        const { commentId } = req.params;
        const { userId } = req.body;

        // Step 1 — already liked kina check koro
        const comment = await commentCollection.findOne({
          _id: new ObjectId(commentId),
        });
        if (!comment)
          return res.status(404).json({ message: "Comment not found" });

        const alreadyLiked = comment.likes?.includes(userId);

        // Step 2 — like ba unlike koro, ar updated data ekসাথে niye asho
        const updated = await commentCollection.findOneAndUpdate(
          { _id: new ObjectId(commentId) },
          alreadyLiked
            ? { $pull: { likes: userId }, $inc: { likeCount: -1 } }
            : { $push: { likes: userId }, $inc: { likeCount: 1 } },
          { returnDocument: "after" },
        );

        // Step 3 — return koro
        res.json({ likeCount: updated.likeCount, likes: updated.likes });
      } catch (err) {
        res.status(500).json({ message: "Server Error" });
      }
    });

    // DELETE — comment delete করো
    app.delete("/comment/:commentId", async (req, res) => {
      try {
        const { commentId } = req.params;
        await commentCollection.deleteOne({ _id: new ObjectId(commentId) });
        res.json({ message: "Comment deleted" });
      } catch (err) {
        res.status(500).json({ message: "Server Error" });
      }
    });

    // PATCH — comment edit করো
    app.patch("/comment/:commentId", async (req, res) => {
      try {
        const { commentId } = req.params;
        const { text } = req.body;
        await commentCollection.updateOne(
          { _id: new ObjectId(commentId) },
          { $set: { text } },
        );
        res.json({ message: "Comment updated" });
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
