# backend/Dockerfile

# 1. Start with an official Node.js image
FROM node:18-slim

# 2. Install the Java Development Kit (JDK)
RUN apt-get update && apt-get install -y default-jdk --no-install-recommends

# 3. Set up the working directory inside the container
WORKDIR /usr/src/app

# 4. Copy package files and install dependencies
# This is done first to leverage Docker's build cache
COPY package*.json ./
RUN npm install

# 5. Copy the rest of your application code
COPY . .

# 6. Define the command to start your server
CMD ["npm", "start"]