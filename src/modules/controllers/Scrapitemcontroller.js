// controllers/scrapItemController.js
const ScrapItem = require('../models/Scraplist'); // Ensure the correct model name
const User=require('../models/AnuUser');
const DeliveryBoy=require('../models/DeliveryBoyNew')
// Create Scrap Item
const { v4: uuidv4 } = require('uuid'); // Import the uuid library

// controllers/scrapItemController.js



const createScrapItem = async (req, res) => {
  try {
    console.log("Authorization Header:", req.headers.authorization);

    const authToken = req.headers.authToken || req.headers.authorization?.split(" ")[1];

    if (!authToken) {
      return res.status(401).json({ message: "Authorization token is required." });
    }

    const { 
      scrapItems, 
      name, 
      pickUpDate, 
      pickUpTime, 
      location, 
      latitude, 
      longitude, 
      anuUser2Id, 
      paymentMode, 
      isVerified = false, 
      isAssigned = false, 
      isInstantPickUp = false 
    } = req.body;

    let parsedScrapItems;
    try {
      parsedScrapItems = JSON.parse(scrapItems); 
    } catch (err) {
      return res.status(400).json({ message: "Invalid scrapItems format", error: err.message });
    }

    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = String(currentDate.getFullYear()).slice(-2);

    const requestNumber = (await ScrapItem.find({})).length + 1;
    const requestId = `${day}${month}${year}${requestNumber}`;

    const newScrapItem = new ScrapItem({
      authToken,
      scrapItems: parsedScrapItems,
      name,
      image: req.file ? req.file.path : null,
      pickUpDate,
      pickUpTime,
      location,
      latitude: parseFloat(latitude) || null,
      longitude: parseFloat(longitude) || null,
      requestId,
      anuUser2: anuUser2Id,
      paymentMode,
      isVerified,
      isAssigned,
      isInstantPickUp
    });

    if (isInstantPickUp && latitude && longitude) {
      const deliveryBoys = await DeliveryBoy.find({
        location: { $geoWithin: { $centerSphere: [[longitude, latitude], 5 / 3963] } }
      }).select("name number");

      // If delivery boys are found, assign one
      if (deliveryBoys.length > 0) {
        const assignedDeliveryBoy = deliveryBoys[0]; // Adjust logic as needed for selection

        newScrapItem.isAssigned = true;
        newScrapItem.name = assignedDeliveryBoy.name;
        newScrapItem.number = assignedDeliveryBoy.number;

        await newScrapItem.save();

        return res.status(200).json({
          status: 200,
          data: {
            requestId: newScrapItem.requestId,
            deliveryBoy: {
              name: assignedDeliveryBoy.name || null,
              number: assignedDeliveryBoy.number || null,
            }
          },
          message: 'Request created and delivery boy assigned.',
        });
      } else {
        // If no delivery boys are found within 5 km
        return res.status(200).json({
          status: 200,
          data: {
            requestId: newScrapItem.requestId,
            deliveryBoy: null, // Indicate that no delivery boy was found
          },
          message: 'Request created, but no delivery boys found within 5 km.',
        });
      }
    }

    // Save the new scrap item if instant pickup is not enabled
    await newScrapItem.save();

    res.status(200).json({
      status: 200,
      data: { requestId: newScrapItem.requestId },
      message: 'Request created successfully',
    });
  } catch (error) {
    console.error("Error creating scrap item:", error);
    res.status(500).json({
      message: 'Error creating scrap item',
      error: error.message || 'Internal server error',
    });
  }
};

// Controller to fetch all scrap requests based on authToken and role
// Fetch requests based on authToken from headers
const getRequestsByAuthTokenAndRole = async (req, res) => {
  try {
    console.log('Request Params:', req.params); // Log the entire params object
    console.log('Full Request URL:', req.originalUrl); // Log the full URL

    // Extract userId from the URL parameters
    const { userId } = req.params;

    console.log('Received User ID:', userId); // Debugging - Check if 'userId' is being passed correctly

    if (!userId) {
      return res.status(400).json({
        message: 'User ID (anuUser2) must be provided in the URL.',
      });
    }

    // Pagination parameters (with default values)
    const page = parseInt(req.query.page) || 1; // Current page number, default is 1
    const limit = parseInt(req.query.limit) || 10; // Items per page, default is 10
    const skip = (page - 1) * limit;

    // Fetch the scrap items associated with the given userId and matching authToken with pagination
    const scrapRequests = await ScrapItem.find({ anuUser2: userId })
      .skip(skip)
      .limit(limit);

    // Count total documents for this query
    const totalDocuments = await ScrapItem.countDocuments({ anuUser2: userId });
    const totalPages = Math.ceil(totalDocuments / limit);

    if (!scrapRequests || scrapRequests.length === 0) {
      return res.status(404).json({
        message: 'No requests found for the provided user ID or invalid auth token.',
      });
    }

    res.status(200).json({
      message: 'Fetched all requests successfully.',
      data: scrapRequests,
      pagination: {
        totalDocuments,
        totalPages,
        currentPage: page,
        pageSize: scrapRequests.length,
      },
    });
  } catch (error) {
    console.error('Error fetching requests by user ID:', error);
    res.status(500).json({
      message: 'Error fetching requests',
      error: error.message,
    });
  }
};


  // Controller to fetch a single scrap request by request ID
  // Controller to fetch a single scrap request by request ID
  const getRequestById = async (req, res) => {
    try {
        const { requestId } = req.params; // Extract requestId from route parameters
        console.log("Received requestId:", requestId); // Log the received requestId

        // Validate the requestId format
        if (!requestId) {
            return res.status(400).json({
                message: 'Request ID must be provided.',
            });
        }

        // Fetch the scrap request by its _id (or appropriate identifier)
        const scrapRequest = await ScrapItem.findById("66f988e33d584b3431f81af9"); // Use actual ID of ScrapItem here

        if (!scrapRequest || !scrapRequest.scrapItems) {
            console.log("No scrap requests found or scrapItems array is empty.");
            return res.status(404).json({
                message: 'No requests found.',
            });
        }

        // Find the specific scrap item by requestId within the scrapItems array
        const foundItem = scrapRequest.scrapItems.find(item => item.requestId === requestId); // Change _id to requestId

        if (!foundItem) {
            console.log("No scrap item found with the requestId:", requestId);
            return res.status(404).json({
                message: 'No request found with the provided request ID.',
            });
        }

        // Exclude authToken from the response (if needed)
        const { authToken, ...rest } = foundItem.toObject();

        res.status(200).json({
            message: 'Fetched request successfully.',
            data: { requestId, ...rest },
        });
    } catch (error) {
        console.error('Error fetching request by ID:', error);
        res.status(500).json({
            message: 'Error fetching request',
            error: error.message,
        });
    }
};

  
// Controller to fetch all scrap requests for all users
const getAllScrapRequests = async (req, res) => {
  try {
    console.log('Fetching all scrap requests');

    // Fetch all scrap requests from the database
    const allScrapRequests = await User.find({});

    if (!allScrapRequests || allScrapRequests.length === 0) {
      return res.status(404).json({
        message: 'No scrap requests found.',
      });
    }

    res.status(200).json({
      message: 'Fetched all scrap requests successfully.',
      data: allScrapRequests,
    });
  } catch (error) {
    console.error('Error fetching all scrap requests:', error);
    res.status(500).json({
      message: 'Error fetching all scrap requests',
      error: error.message,
    });
  }
};
const getAllScrap = async (req, res) => {
  try {
    console.log('Fetching all scrap requests');

    // Fetch all scrap requests from the database
    const allScrapRequests = await ScrapItem.find({});

    if (!allScrapRequests || allScrapRequests.length === 0) {
      return res.status(404).json({
        message: 'No scrap requests found.',
      });
    }

    res.status(200).json({
      message: 'Fetched all scrap requests successfully.',
      data: allScrapRequests,
    });
  } catch (error) {
    console.error('Error fetching all scrap requests:', error);
    res.status(500).json({
      message: 'Error fetching all scrap requests',
      error: error.message,
    });
  }
};
const cancelScrapItem = async (req, res) => {
  try {
    const { id } = req.params;
    const scrapItem = await ScrapItem.findById(id);

    if (!scrapItem) {
      return res.status(404).json({ message: 'Scrap item not found.' });
    }

    scrapItem.status = 'cancelled'; 
    await scrapItem.save();

    res.status(200).json({
      status: 200,
      message: 'Scrap item request cancelled successfully.',
      data: { requestId: scrapItem.requestId },
    });
  } catch (error) {
    console.error("Error canceling scrap item:", error);
    res.status(500).json({
      message: 'Error canceling scrap item',
      error: error.message || 'Internal server error',
    });
  }
};
  // Get Requests by Status
 
  

module.exports = { createScrapItem ,getRequestsByAuthTokenAndRole,getRequestById,getAllScrapRequests,getAllScrap,cancelScrapItem};
