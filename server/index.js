
const express = require("express");
const { ApolloServer } = require("apollo-server-express");
const mongoose = require("mongoose");
const client = require("prom-client");
const { MONGODB } = require("./config");
const typeDefs = require("./graphql/Schema");
const resolvers = require("./graphql/resolvers");
const { authMiddleware } = require("./utils/authMiddleware");

const app = express();

// --- PROMETHEUS SETUP ---
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const gqlRequests = new client.Counter({
  name: "graphql_requests_total",
  help: "Total number of GraphQL requests",
});
register.registerMetric(gqlRequests);

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});
// -------------------------

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    const me = authMiddleware(req);
    gqlRequests.inc();
    return { me };
  },
});

async function startServer() {
  await server.start();

  // Mount Apollo Server at "/"
  server.applyMiddleware({ app, path: "/" });

  mongoose
    .connect(MONGODB, { useNewUrlParser: true })
    .then(() => {
      console.log("MongoDB Connected");
      app.listen({ port: 5000 }, () => {
        console.log(` Server ready at http://localhost:5000/`);
        console.log(`Metrics available at http://localhost:5000/metrics`);
      });
    })
    .catch((err) => console.error(err));
}

startServer();
