db.livecards.updateOne({hostId: '1065527'}, {$set: {isLive: false, streamStatus: 'ended', endTime: new Date()}});
print('Updated, active:', db.livecards.countDocuments({isLive: true}));
