const mongoose = require('mongoose');
mongoose.connect('mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin')
  .then(async () => {
    const items = await mongoose.connection.collection('items').find().toArray();
    console.log(`Total items: ${items.length}`);
    if (items.length > 0) {
      console.log('Sample item @id:', items[0]['@id']);
    }
    process.exit(0);
  });
