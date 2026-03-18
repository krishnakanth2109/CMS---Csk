import Client from '../models/Client.js';

// @desc    Get all clients
// @route   GET /api/clients
export const getClients = async (req, res) => {
  try {
    // .lean() returns plain JS objects instead of Mongoose documents — 2-3x faster for reads
    const clients = await Client.find({}).sort({ createdAt: -1 }).lean();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create client
// @route   POST /api/clients
export const createClient = async (req, res) => {
  try {
    const { clientId } = req.body;

    // Auto-generate ID: find the highest existing CL number and increment
    // (countDocuments is unreliable with deletions — can produce duplicate IDs)
    let finalClientId = clientId;
    if (!finalClientId) {
      const last = await Client.findOne({ clientId: { $regex: /^CL/ } })
        .sort({ clientId: -1 })
        .select('clientId')
        .lean();
      const lastNum = last?.clientId ? parseInt(last.clientId.replace('CL', ''), 10) : 1000;
      finalClientId = `CL${lastNum + 1}`;
    }

    const client = await Client.create({ ...req.body, clientId: finalClientId });
    res.status(201).json(client);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update client
// @route   PUT /api/clients/:id
export const updateClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, lean: true }
    );
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete client
// @route   DELETE /api/clients/:id
export const deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id).lean();
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json({ message: 'Client removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};