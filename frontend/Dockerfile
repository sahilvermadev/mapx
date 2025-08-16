# Use an official Node.js runtime for building the React app
FROM node:20-alpine as build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Build the React app
RUN npm run build

# Use a lightweight web server (like Nginx) to serve the static built files
FROM nginx:alpine

# Copy custom nginx config (if needed, otherwise default is fine for MVP)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built React app to Nginx's public directory
COPY --from=build /app/build /usr/share/nginx/html

# Expose the default Nginx port
EXPOSE 80

# Command to start Nginx
CMD ["nginx", "-g", "daemon off;"]