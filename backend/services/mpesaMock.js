export const simulateMpesaPayment = async (transaction, callback) => {
  console.log("📲 M-Pesa STK Push sent...");

  // simulate delay
  setTimeout(() => {
    console.log("✅ M-Pesa Payment Successful");

    callback({
      success: true,
      transactionId: transaction._id
    });

  }, 4000); // 4 seconds delay
};