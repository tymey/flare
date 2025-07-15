import Event from "../models/events";
import Notification from "../models/notifications";
import Event_Interest from "../models/events_interests";
import Event_Venue_Image from "../models/event_venue_images";
import Event_Venue_Tag from "../models/event_venue_tags";
import Chatroom from "../models/chatrooms";
import User_Event from "../models/users_events";

type SeedNotification = {
  title: string | null;
  message: string;
  send_time: Date;
};

type SeedEvent = {
  title: string;
  start_time: Date;
  end_time: Date;
  description: string;
  venue_id: number;
  category_id: number;
  created_by: number;
  hour_before_notif: number;
};

type SeedEventInterest = {
  EventId: number;
  InterestId: number;
};

type SeedEventVenueImage = {
  display_order: number;
  EventId: number;
  VenueImageId: number;
};

type SeedEventVenueTag = {
  display_order: number;
  EventId: number;
  VenueTagId: number;
};

type SeedChatroom = {
  event_id: number;
}

type SeedUserEvent = {
  UserId: number;
  EventId: number;
};

const now = Date.now();
const hour = 1000 * 60 * 60;
const thirtyMinutes = hour / 2;

const notifications: SeedNotification[] = [
  { // #1: Karaoke Night
    title: null,
    message: `The upcoming event you're attending, Karaoke Night, starts soon in an hour. Hope to see you there.`,
    send_time: new Date(now), // 03.16.25 => 6:00 PM
  },
  { // #2: Op Spark Showcase After Party
    title: null,
    message: `The upcoming event you're attending, Op Spark Showcase After Party, starts soon in an hour. Hope to see you there.`,
    send_time: new Date(now + thirtyMinutes), // 03.13.25 => 7:00 PM
  },
  { // #3: Hack Night
    title: null,
    message: `The upcoming event you're attending, Hack Night, starts soon in an hour. Hope to see you there.`,
    send_time: new Date(now + (23 * hour)), // 03.18.25 => 6:00 PM
  },
];

const events: SeedEvent[] = [
  /* #1 Karaoke Night */
  {
    title: 'Karaoke Night',
    start_time: new Date(now + hour), // 03.16.25 => 7:00 PM
    end_time: new Date(now + (4 * hour)), // 03.16.25 => 10:00 PM
    description: `Let's get together for some karaoke before the start of the work week.`,
    venue_id: 1, // Kajun's Pub
    category_id: 1, // Casual Meetups
    created_by: 1, // Leeroy Jenkins
    hour_before_notif: 1,
  },

  /* #2 Op Spark Showcase After Party */
  {
    title: 'Op Spark Showcase After Party',
    start_time: new Date(now + hour + thirtyMinutes), // 03.13.25 => 8:00 PM
    end_time: new Date(now + (3 * hour) + thirtyMinutes), // 03.13.25 => 10:00 PM
    description: `Let's have a drink and celebrate Operation Spark's new graduates.`,
    venue_id: 2, // Anna's
    category_id: 1, // Casual Meetups
    created_by: 2, // John Smith
    hour_before_notif: 2,
  },

  /* #3 Hack Night */
  {
    title: 'Hack Night',
    start_time: new Date(now + (24 * hour)), // 03.18.25 => 7:00 PM
    end_time: new Date(now + (25 * hour)), // 03.18.25 => 9:00 PM
    description: `We're aggressively unstructured, meaning that Hack Night is what you want it to be. It's a social time for some, a place to work for others. It's a great place to meet other tech-minded folk.`,
    venue_id: 3, // The Rusty Nail
    category_id: 9, // Professional & Career
    created_by: 3, // Susan Bellum
    hour_before_notif: 3,
  },
];

const eventInterests: SeedEventInterest[] = [
  /* #1: Karaoke Night */
  { EventId: 1, InterestId: 2 }, // Music
  { EventId: 1, InterestId: 10 }, // Nightlife

  /* #2: Op Spark Showcase After Party */
  { EventId: 2, InterestId: 7 }, // Technology
  { EventId: 2, InterestId: 10 }, // Nightlife
  { EventId: 2, InterestId: 15 }, // Community Events

  /* #3: Hack Night */
  { EventId: 3, InterestId: 7 }, // Technology
  { EventId: 3, InterestId: 15 }, // Community Events
];

const eventVenueImages: SeedEventVenueImage[] = [
  /* #1 Karaoke Night */
  { display_order: 0, EventId: 1, VenueImageId: 1 },
  { display_order: 1, EventId: 1, VenueImageId: 3 },
  { display_order: 2, EventId: 1, VenueImageId: 6 },

  /* #2 Op Spark Showcase After Party */
  { display_order: 0, EventId: 2, VenueImageId: 8 },
  { display_order: 1, EventId: 2, VenueImageId: 12 },
  { display_order: 2, EventId: 2, VenueImageId: 7 },
  { display_order: 3, EventId: 2, VenueImageId: 10 },

  /* #3 Hack Night */
  { display_order: 0, EventId: 3, VenueImageId: 17 },
  { display_order: 1, EventId: 3, VenueImageId: 13 },
];

const eventVenueTags: SeedEventVenueTag[] = [
  /* #1 Karaoke Night */
  { display_order: 0, EventId: 1, VenueTagId: 12 }, // Karaoke
  { display_order: 1, EventId: 1, VenueTagId: 7 }, // Casual
  { display_order: 2, EventId: 1, VenueTagId: 16 }, // Eclectic
  { display_order: 3, EventId: 1, VenueTagId: 20 }, // Sing
  { display_order: 4, EventId: 1, VenueTagId: 21 }, // Atmosphere

  /* #2: Op Spark Showcase After Party */
  { display_order: 0, EventId: 2, VenueTagId: 33 }, // Cosy Atmosphere
  { display_order: 1, EventId: 2, VenueTagId: 38 }, // Pool Table
  { display_order: 2, EventId: 2, VenueTagId: 31 }, // Casual
  { display_order: 3, EventId: 2, VenueTagId: 32 }, // Neighborhood

  /* #3: Hack Night */
  { display_order: 0, EventId: 3, VenueTagId: 44 }, // Bar
  { display_order: 1, EventId: 3, VenueTagId: 47 }, // Outdoor Seating
  { display_order: 2, EventId: 3, VenueTagId: 49 }, // Casual
  { display_order: 3, EventId: 3, VenueTagId: 65 }, // Disco Lemonade
  { display_order: 4, EventId: 3, VenueTagId: 67 }, // Courtyard
];

const chatrooms: SeedChatroom[] = [
  /* #1 Karaoke Night */
  { event_id: 1 },

  /* #2 Op Spark Showcase After Party */
  { event_id: 2 },

  /* #2 Hack Night */
  { event_id: 3 },
];

const userEvents: SeedUserEvent[] = [
  /* #1 Karaoke Night */
  { UserId: 1, EventId: 1 }, // Leeroy Jenkins
  { UserId: 2, EventId: 1 }, // John Smith
  { UserId: 3, EventId: 1 }, // Susan Bellum

  /* #2 Op Spark Showcase After Party */
  { UserId: 1, EventId: 2 }, // Leeroy Jenkins
  { UserId: 2, EventId: 2 }, // John Smith

  /* #3 Hack Night */
  { UserId: 1, EventId: 3 }, // Leeroy Jenkins
  { UserId: 3, EventId: 3 }, // Susan Bellum
];

const seedEvents = async () => {
  try {
    await Notification.bulkCreate(notifications);
    await Event.bulkCreate(events);
    await Event_Interest.bulkCreate(eventInterests);
    await Event_Venue_Image.bulkCreate(eventVenueImages);
    await Event_Venue_Tag.bulkCreate(eventVenueTags);
    await Chatroom.bulkCreate(chatrooms);
    await User_Event.bulkCreate(userEvents);
    console.log('Events Seeded.')
  } catch (error: unknown) {
    console.error('Failed to seed events:', error);
  }
};

export default seedEvents;
