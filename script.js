import bcrypt from 'bcrypt';

const newHash = await bcrypt.hash("Teacher123!", 10);
console.log(newHash); // Mettez à jour la base de données avec ce hash