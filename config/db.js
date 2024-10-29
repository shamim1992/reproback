import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://editorneportal:*meghalaya1@cluster0.0kqy5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
    console.log('MongoDB connected...');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

export default connectDB;
