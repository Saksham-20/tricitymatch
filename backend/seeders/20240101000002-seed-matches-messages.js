'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const { User, Profile, Match, Message } = require('../models');
    const { Op } = require('sequelize');
    const now = new Date();

    // Define the exact match pairs we want to create (using seeder emails)
    // These are all premium/elite users who have subscription access for chat
    const matchPairEmails = [
      { male: 'rahul.sharma1@example.com', female: 'priya.sharma1@example.com' },
      { male: 'aman.singh2@example.com', female: 'anjali.singh2@example.com' },
      { male: 'karan.kumar3@example.com', female: 'kavya.kumar3@example.com' },
      { male: 'arjun.verma4@example.com', female: 'neha.verma4@example.com' },
      { male: 'rohit.gupta5@example.com', female: 'riya.gupta5@example.com' },
    ];

    const matches = [];
    const messages = [];

    // Create mutual matches between specific premium users
    for (const pair of matchPairEmails) {
      // Find the male user by email
      const maleUser = await User.findOne({
        where: { email: pair.male },
        include: [{ model: Profile }]
      });

      // Find the female user by email
      const femaleUser = await User.findOne({
        where: { email: pair.female },
        include: [{ model: Profile }]
      });

      if (!maleUser || !femaleUser) {
        console.log(`Skipping pair: ${pair.male} <-> ${pair.female} (user not found)`);
        continue;
      }

      if (!maleUser.Profile || !femaleUser.Profile) {
        console.log(`Skipping pair: ${pair.male} <-> ${pair.female} (profile not found)`);
        continue;
      }

      console.log(`Creating mutual match: ${maleUser.Profile.firstName} <-> ${femaleUser.Profile.firstName}`);

      const mutualMatchDate = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);

      // Male likes female
      matches.push({
        id: uuidv4(),
        userId: maleUser.id,
        matchedUserId: femaleUser.id,
        action: 'like',
        compatibilityScore: 85 + Math.floor(Math.random() * 15),
        isMutual: true,
        mutualMatchDate: mutualMatchDate,
        createdAt: mutualMatchDate,
        updatedAt: mutualMatchDate
      });

      // Female likes male (mutual match)
      matches.push({
        id: uuidv4(),
        userId: femaleUser.id,
        matchedUserId: maleUser.id,
        action: 'like',
        compatibilityScore: 85 + Math.floor(Math.random() * 15),
        isMutual: true,
        mutualMatchDate: mutualMatchDate,
        createdAt: mutualMatchDate,
        updatedAt: mutualMatchDate
      });

      // Create sample messages for this pair
      const conversationMessages = [
        { sender: maleUser.id, receiver: femaleUser.id, content: `Hi ${femaleUser.Profile.firstName}! I noticed we have a lot in common. How are you?`, minutesAgo: 120 },
        { sender: femaleUser.id, receiver: maleUser.id, content: `Hi ${maleUser.Profile.firstName}! I'm good, thanks for reaching out. Yes, I saw we're both from the Tricity area!`, minutesAgo: 115 },
        { sender: maleUser.id, receiver: femaleUser.id, content: "That's great! I love how vibrant the city is. What do you enjoy doing in your free time?", minutesAgo: 110 },
        { sender: femaleUser.id, receiver: maleUser.id, content: "I enjoy reading, going for walks in Sukhna Lake, and trying out new restaurants. How about you?", minutesAgo: 100 },
        { sender: maleUser.id, receiver: femaleUser.id, content: "Nice! I love Sukhna Lake too. I'm into fitness, music, and occasionally photography. Maybe we could grab coffee sometime?", minutesAgo: 90 },
        { sender: femaleUser.id, receiver: maleUser.id, content: "That sounds lovely! I'd like that. When are you free?", minutesAgo: 80 },
      ];

      conversationMessages.forEach((msg, idx) => {
        const msgTime = new Date(now.getTime() - msg.minutesAgo * 60 * 1000);
        const isLastFew = idx >= conversationMessages.length - 2;
        
        messages.push({
          id: uuidv4(),
          senderId: msg.sender,
          receiverId: msg.receiver,
          content: msg.content,
          isRead: !isLastFew, // Last 2 messages unread for demo
          deliveredAt: msgTime,
          readAt: !isLastFew ? new Date(msgTime.getTime() + 5 * 60 * 1000) : null,
          createdAt: msgTime,
          updatedAt: msgTime
        });
      });
    }

    // Insert matches - handle duplicates for PostgreSQL
    if (matches.length > 0) {
      try {
        // For PostgreSQL, use updateOnDuplicate or catch errors
        for (const matchData of matches) {
          try {
            // Check if match already exists
            const existingMatch = await Match.findOne({
              where: {
                userId: matchData.userId,
                matchedUserId: matchData.matchedUserId
              }
            });
            
            if (existingMatch) {
              // Update existing match to be mutual
              await existingMatch.update({
                isMutual: true,
                mutualMatchDate: matchData.mutualMatchDate
              });
              console.log(`Updated existing match: ${matchData.userId} -> ${matchData.matchedUserId}`);
            } else {
              // Create new match
              await Match.create(matchData);
              console.log(`Created new match: ${matchData.userId} -> ${matchData.matchedUserId}`);
            }
          } catch (err) {
            console.error(`Error creating/updating match: ${err.message}`);
          }
        }
        console.log(`Processed ${matches.length} matches`);
      } catch (error) {
        console.error('Error creating matches:', error.message);
      }
    }

    // Insert messages
    if (messages.length > 0) {
      try {
        await Message.bulkCreate(messages);
        console.log(`Created ${messages.length} messages`);
      } catch (error) {
        console.error('Error creating messages:', error.message);
        // Try creating messages one by one if bulk fails
        for (const msg of messages) {
          try {
            await Message.create(msg);
          } catch (err) {
            console.error(`Error creating message: ${err.message}`);
          }
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Messages', null, {});
    await queryInterface.bulkDelete('Matches', null, {});
  }
};
