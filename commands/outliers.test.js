const outliersCommand = require('./outliers');
const { MessageFlags } = require('discord.js');

describe('outliers command', () => {
  let mockInteraction;
  let mockContext;

  beforeEach(() => {
    mockInteraction = {
      deferReply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue(),
      user: { id: 'admin_user_id', username: 'admin' },
    };

    mockContext = {
      db: {
        getOutliers: jest.fn(),
      },
      buildProgressCsv: jest.fn().mockReturnValue(Buffer.from('id,knightLevel\n1,1200')),
      sendDmWithAttachment: jest.fn(),
    };
  });

  test('replies with no outliers message when none found', async () => {
    mockContext.db.getOutliers.mockResolvedValue([]);

    await outliersCommand.execute(mockInteraction, [], mockContext);

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(mockContext.db.getOutliers).toHaveBeenCalledTimes(1);
    expect(mockInteraction.editReply).toHaveBeenCalledWith({ content: 'No potential outlier records found.' });
    expect(mockContext.sendDmWithAttachment).not.toHaveBeenCalled();
  });

  test('generates csv and sends DM successfully when outliers found', async () => {
    const mockOutliers = [{ id: 1, knightLevel: 1200 }];
    mockContext.db.getOutliers.mockResolvedValue(mockOutliers);
    mockContext.sendDmWithAttachment.mockResolvedValue(true);

    await outliersCommand.execute(mockInteraction, [], mockContext);

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(mockContext.db.getOutliers).toHaveBeenCalledTimes(1);
    expect(mockContext.buildProgressCsv).toHaveBeenCalledWith(mockOutliers);
    expect(mockContext.sendDmWithAttachment).toHaveBeenCalledWith(
      mockInteraction.user,
      'Here is the CSV file containing potential outlier records.',
      expect.any(Buffer),
      'outliers.csv'
    );
    expect(mockInteraction.editReply).toHaveBeenCalledWith({ content: 'Sent potential outlier records to your DMs.' });
  });

  test('replies with failure message if DM cannot be sent', async () => {
    const mockOutliers = [{ id: 1, knightLevel: 1200 }];
    mockContext.db.getOutliers.mockResolvedValue(mockOutliers);
    mockContext.sendDmWithAttachment.mockResolvedValue(false);

    await outliersCommand.execute(mockInteraction, [], mockContext);

    expect(mockContext.sendDmWithAttachment).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Unable to send you a DM. Please enable direct messages from this server and try again.',
    });
  });

  test('replies with generic error message if query fails', async () => {
    mockContext.db.getOutliers.mockRejectedValue(new Error('DB Error'));

    await outliersCommand.execute(mockInteraction, [], mockContext);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Something went wrong while generating the outliers CSV.',
    });
  });
});
