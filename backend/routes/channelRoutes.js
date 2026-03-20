import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  getChannelMessages,
  sendChannelMessage,
  updateChannelMembers,
  deleteChannelMessage,
} from '../controllers/channelController.js';

const router = express.Router();
router.use(protect);

router.route('/')
  .get(getChannels)
  .post(createChannel);

router.route('/:id')
  .put(updateChannel)
  .delete(deleteChannel);

router.route('/:id/messages')
  .get(getChannelMessages)
  .post(sendChannelMessage);

router.put('/:id/members', updateChannelMembers);
router.delete('/:id/messages/:msgId', deleteChannelMessage);

export default router;
