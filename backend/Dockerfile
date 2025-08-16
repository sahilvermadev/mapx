# Use a specific Node.js version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install all dependencies (including devDependencies like ts-node-dev)
RUN npm install

# Copy all source code
COPY . .

# Exposed port
EXPOSE 5000

# Command to run the application using ts-node-dev
CMD ["npm", "run", "dev"]