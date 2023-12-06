const express = require('express');
require('dotenv').config();
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const app = express();



app.use(express.json());
app.use(cors({
    origin: ['https://delightful-snickerdoodle-2643ae.netlify.app', 'http://localhost:5173'],
    credentials: true
}));

// own midlewares
const varifyToken = (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRETS, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { default: Stripe } = require('stripe');
const uri = `mongodb+srv://${process.env.MY_DB_USER}:${process.env.MY_DB_PSS}@cluster0.dejlh8b.mongodb.net/?retryWrites=true&w=majority`;

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
        // await client.connect();


        const userCollection = client.db("diagnostic").collection("users");
        const bookingCollection = client.db("diagnostic").collection("bookings");
        const testCollection = client.db("diagnostic").collection("tests");
        const testRusltCollection = client.db("diagnostic").collection("testResult");
        const doctorCollection = client.db("diagnostic").collection("doctors");
        const bannerCollection = client.db("diagnostic").collection("banners");
        const activeBannerCollection = client.db("diagnostic").collection("activeBanner");
        const paymentCollection = client.db("diagnostic").collection("payments");

        // varify admin
        const varifyAdmin = async (req, res, next) => {
            const email = req.decoded?.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRETS, { expiresIn: '1h' });
            res.send({ token });
        })

        // user related api
        app.get('/users', varifyToken, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        // varify admin
        app.get('/users/admin/:email', varifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })

        // post users
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User already exisits' });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        app.get('/usersInfo/:email', async (req, res) => {
            const userEmail = req.params.email;
            const filter = { email: userEmail }
            const cursor = await userCollection.findOne(filter);
            res.send(cursor);
        })

        // admin related api
        app.patch('/users/admin/:id', varifyToken, varifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // name, email, district, upazila, blood
        app.put('/updateUser/:email', varifyToken, async (req, res) => {
            const userEmail = req.params.email;
            const data = req.body;
            console.log(data);
            const filter = { email: userEmail };
            const update = {
                $set: {
                    name: data.name,
                    email: data.email,
                    district: data.district,
                    upazila: data.upazila,
                    blood: data.blood,
                }
            }
            const result = await userCollection.updateMany(filter, update);
        });

        // user status
        app.patch('/users/status/:id', varifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: 'blocked'
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // delete user
        app.delete('/users/:id', varifyToken, varifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // booking item post  
        app.post('/bookings', varifyToken, async (req, res) => {
            const item = req.body;
            const result = await bookingCollection.insertOne(item);
            res.send(result);
        })

        // all booking item get  
        app.get('/bookings', varifyToken, async (req, res) => {
            const cursor = await bookingCollection.find().toArray();
            res.send(cursor);
        })

        // all booking item get  
        app.get('/bookings/:email', varifyToken, async (req, res) => {
            const userEmail = req.params.email;
            const filter = { email: userEmail }
            const cursor = await bookingCollection.find(filter).toArray();
            res.send(cursor);
        })

        // booking sigle item get  
        app.patch('/bookings/:id', varifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: 'Canceled'
                }
            }
            const result = await bookingCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        // ========doctor realted api=========

        app.get('/doctors', async (req, res) => {
            const result = await doctorCollection.find().toArray();
            res.send(result);
        })


        // ============test related api========

        app.post('/tests', varifyToken, async (req, res) => {
            const item = req.body;
            const result = await testCollection.insertOne(item);
            res.send(result);
        })

        // tests related api   
        app.get('/tests', async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
            const result = await testCollection.find().skip(page * size).limit(size).toArray();
            res.send(result);
        })

        app.get('/testCount', async (req, res) => {
            const count = await testCollection.estimatedDocumentCount();
            res.send({ count });
        })

        app.get('/tests/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const cursor = await testCollection.findOne(filter);
            res.send(cursor);
        })

        app.put('/tests/:id', varifyToken, varifyAdmin, async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) };
            const update = {
                $set: {
                    testName: data.testName,
                    image: data.image,
                    price: data.price,
                    date: data.date,
                    time: data.time,
                    slot: data.slot,
                    details: data.details,
                }
            }
            const result = await testCollection.updateMany(filter, update);
        });

        // update test collection sigle item 
        app.patch('/testsCancel/:id', varifyToken, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: 'Canceled'
                }
            }
            const result = await testRusltCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // test delete  
        app.delete('/tests/:id', varifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await testCollection.deleteOne(query);
            res.send(result);
        })


        // =========================payment related api======================= j
        app.post("/create-payment-intent", async (req, res) => {
            const { payAmount } = req.body;
            const amount = parseInt(payAmount * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']

            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body;

            const paymentPost = await paymentCollection.insertOne(payment);

            // update slot
            const query = { _id: new ObjectId(payment.testId) }
            const update = {
                $set: {
                    slot: payment.slot,
                }
            }
            const testSlotUpdate = await testCollection.updateOne(query, update);

            // test result post
            const testResult = await testRusltCollection.insertOne(payment);
            res.send({ paymentPost, testSlotUpdate, testResult });
        })

        // get payment history
        app.get('/payments/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })

        // =======================test result==========================
        app.get('/testResult/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const cursor = await testRusltCollection.find(filter).toArray();
            res.send(cursor);
        })

        app.get('/testResultCount', async (req, res) => {
            const count = await testRusltCollection.estimatedDocumentCount();
            res.send({ count });
        })

        // get payment history
        app.get('/seeReport/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await testRusltCollection.findOne(query);
            res.send(result);
        })


        // ============================banner related api ====================
        app.post('/banners', varifyToken, async (req, res) => {
            const item = req.body;
            const result = await bannerCollection.insertOne(item);
            res.send(result);
        })

        // all banner get  
        app.get('/banners', varifyToken, async (req, res) => {
            const cursor = await bannerCollection.find().toArray();
            res.send(cursor);
        })
        // sigle  banner get  
        app.get('/banners/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const cursor = await bannerCollection.findOne(query);
            res.send(cursor);
        })

        // update banner
        app.put('/banners/:id', varifyToken, async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    bannerHeading: data.bannerHeading,
                    bannerImg: data.bannerImg,
                    btnLink: data.btnLink,
                    bannerDesc: data.bannerDesc
                }
            };
            const result = await bannerCollection.updateOne(filter, updateDoc);
            res.send(result);
        });
        // set banner
        app.patch('/activeBanner/:id', varifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const data = req.body;
                const updatedBannerId = data.bannerId.bannerId || data.bannerId;
                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: {
                        bannerId: updatedBannerId
                    }
                };
                const result = await activeBannerCollection.updateOne(filter, updateDoc);

                res.send(result);
            } catch (error) {
                console.error('Error updating banner:', error);
                res.status(500).send('Internal Server Error');
            }
        });


        // all banner get  
        app.get('/activeBanner', async (req, res) => {
            const cursor = await activeBannerCollection.find().toArray();
            res.send(cursor);
        })


        app.get('/testResult', async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
            const result = await testRusltCollection.find().skip(page * size).limit(size).toArray();
            res.send(result);
        })

        // update test result
        // user status
        app.patch('/addReport/:id', varifyToken, varifyAdmin, async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'complete',
                    report: data.report,
                }
            };
            const options = {
                upsert: true // Set to true to perform an upsert
            };

            const result = await testRusltCollection.updateMany(filter, updateDoc, options);
            res.send(result);
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






app.get('/', async (req, res) => {
    res.send('My server is running now')
})
app.listen(port, () => {
    console.log('Server is running now on port', port)
})
