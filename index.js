const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
// verify jwt middleware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

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
    const paymentCollection = client.db("summerSportsHub").collection("payments");

    // jwt related api
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token });
    });

    // verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      console.log(user)
      if (user?.role !== 'admin') {
        return res.status.send({ error: true, message: 'forbidden' })
      }
      next();
    }

    // get all classes data
    app.get('/classes', async (req, res) => {
      const cursor = classesCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })

    // post instructors data
    app.post('/instructors', async(req,res) =>{
      const data = req.body;
      const result = await instructorsCollection.insertOne(data);
      res.send(result);
    })

    // get all instructors data
    app.get('/instructors', async (req, res) => {
      const cursor = instructorsCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })

    // get limited instructors data
    app.get('/instructors/popular', async (req, res) => {
      const cursor = instructorsCollection.find();
      const result = await cursor.limit(6).toArray();
      res.send(result)
    })

    // post cart add to cart
    app.post('/carts', async (req, res) => {
      const classItem = req.body;
      console.log(classItem);
      const result = await cartCollection.insertOne(classItem);
      res.send(result);
    })

    app.get('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.findOne(query);
      res.send(result);
    })

    // read specific user cart data
    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email
      console.log(email)
      if (!email) {
        res.send([]);
      };

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      };

      const query = { email: email }
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })

    // delete cart data using id
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })

    // users related apis
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send(({ message: 'User already exist' }))
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    // get all user data
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result)
    });

    // admin update api
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: { role: 'admin' }
      }
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    // check admin
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result)
    })

    // instructor update api
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: { role: 'instructor' }
      }
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    // check instructor
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result)
    })


    // payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    // payment related api
    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
      console.log(payment);
      const id = payment.cartItems;
      console.log(id);
      // const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
      // const deleteResult = await cartCollection.deleteOne(query)
      const query = { _id: new ObjectId(id) }
      const deleteResult = await cartCollection.deleteOne(query)

      res.send({ insertResult, deleteResult });
    });

    app.get('/payments', async(req,res) =>{
      console.log(req.query.email);
      let query = {};
      if(req.query?.email){
        query = {email: req.query.email}
      };
      const cursor = paymentCollection.find(query);
      const result = await cursor.toArray();
      res.send(result)
    });


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