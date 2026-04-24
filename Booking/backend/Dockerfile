# Use Node.js as base image
FROM node:18
# Giving some errors related to bcrypt when use node:18-alpine
# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose port
EXPOSE 5002

# Start the application
CMD ["node", "server.js"]
