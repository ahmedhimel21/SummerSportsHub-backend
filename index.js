const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

// summerSportsHub
// FiK0D6Au6bsGaR0C

// middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('summerSportsHub is running');
})


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hltgyxi.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const classesCollection = client.db('summerSportsHub').collection('classesCollection');
    const instructorsCollection = client.db('summerSportsHub').collection('instructorsCollection');
    const cartCollection = client.db('summerSportsHub').collection('cartCollection')
    const usersCollection = client.db('summerSportsHub').collection('users')

    // get all classes data
    app.get('/classes',async(req,res) =>{
      const cursor = classesCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })

    // get all instructors data
    app.get('/instructors', async(req,res) =>{
      const cursor = instructorsCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })
    // get limited instructors data
    app.get('/instructors/popular', async(req,res) =>{
      const cursor = instructorsCollection.find();
      const result = await cursor.limit(6).toArray();
      res.send(result)
    })

    // post cart add to cart
    app.post('/carts', async(req,res) =>{
      const classItem = req.body;
      console.log(classItem);
      const result = await cartCollection.insertOne(classItem);
      res.send(result);
    })

    // read specific user cart data
    app.get('/carts', async(req,res) =>{
      const email = req.query.email
      console.log(email)
      if(!email){
        res.send([]);
      }
      const query = {email: email}
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })

    // delete cart data using id
    app.delete('/carts/:id', async(req,res) =>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })
    // users related apis
    app.post('/users',async(req,res) =>{
      const user = req.body;
      const query = {email: user.email}
      const existingUser = await usersCollection.findOne(query);
      if(existingUser){
        return res.send(({message: 'User already exist'}))
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    // get all user data
    app.get('/users',async(req,res) =>{
      const result = await usersCollection.find().toArray();
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`SummerSportsHub server running on port: ${port}`)
})