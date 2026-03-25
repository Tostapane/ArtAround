import mongoose from "mongoose";
const MONGO_URI =
  "mongodb://localuser:localpassword@mongodb:27017/?authSource=admin";

async function runTestDB() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: "bookstore" });
    console.log("test connected!");

    const bookSchema = new mongoose.Schema({
      title: String,
      author: String,
      pages: Number,
      genres: [String],
    }); // Explicitly set collection name if needed

    const Book = mongoose.model("Book", bookSchema);

    await Book.create({
      title: "abc",
      author: "def",
    });

    const newBook = new Book({
      title: "titl",
      author: "autho",
    });
    await newBook.save();

    const manyBooks = [
      { title: "a", author: "b", pages: 10 },
      { title: "c", author: "d", pages: 20 },
      { title: "g", author: "f" },
    ];
    await Book.insertMany(manyBooks);

    const allBooks = await Book.find({});
    console.log("Found books:", allBooks);
    await mongoose.disconnect();
    console.log("disconnected");
  } catch (err) {
    console.error("test error", err);
  }
}
