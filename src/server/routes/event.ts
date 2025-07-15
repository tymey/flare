import { Router, Request, Response } from 'express';
import Category from '../db/models/categories';
import Event from '../db/models/events';
import Venue from '../db/models/venues';
import User from '../db/models/users';
import Chatroom from '../db/models/chatrooms';
import Interest from '../db/models/interests';
import dayjs from 'dayjs';
import { Op } from 'sequelize';
import { checkForFlares } from '../helpers/flares';
import User_Notification from '../db/models/users_notifications';
import Venue_Tag from "../db/models/venue_tags";
import Venue_Image from '../db/models/venue_images';
import Notification from '../db/models/notifications';
import Event_Venue_Image from '../db/models/event_venue_images';
import Event_Venue_Tag from '../db/models/event_venue_tags';
import User_Event from '../db/models/users_events';

// helper fns
import { getVenueDogFriendly, getVenueVeganFriendly, isVenueMatch, removeDuplicateVenues, runApifyActor, getGooglePlaceId, convertFSQPrice, getVenueTags, formatState, getVenueAlcohol, getVenueRating, getPopularTime, formatPhoneNumber, getVenueAccessibility, getVenueReviewCount, getVenueImages, }
    from '../../../utils/venue';
import { type VenueType, type GoogleData, } from '../../types/Venues';


const eventRouter = Router();


eventRouter.get('/search', async (req: any, res: Response): Promise<void> => {
    try {
        // user venue selection from search input field
        const { searchInput, latitude, longitude } = req.query;

        // find venues in db that match search input
        const dbVenues = await Venue.findAll({
            where: {
                name: {
                    [Op.like]: `%${searchInput}%` // case insensitive
                }
            }
        });

        // FSQ API CALL - retrieves venues for autocomplete results
        const searchParams = new URLSearchParams({
            input: searchInput ? searchInput : "The",
            key: `${process.env.GOOGLE_PLACES_API_KEY}`
        });

        if (latitude && longitude) {
            searchParams.append('location', `${latitude},${longitude}`);
        }
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?${searchParams}`
        );

        // api response data
        const data = await response.json();

        // map response obj send back only necessary data
        const mappedData = data.predictions.map((result: any) => ({
            name: result.structured_formatting.main_text,
            street_address: result.structured_formatting.secondary_text,
            // zip_code: parseInt(result.place.location.postcode),
            city_name: result.terms[2] ? result.terms[2].value : '',
            state_name: result.terms[3] ? result.terms[3].value : '',
            place_id: result.place_id,
        }));
        // combine both venue results
        const combinedResults = [...dbVenues, ...mappedData]
        // de-duplicate
        const uniqueResults = removeDuplicateVenues(combinedResults);
        res.json(uniqueResults);
    } catch (error: any) {
        console.error('Error getting venue data from FSQ API', error);
        res.sendStatus(500);
    }
})




// create event route
eventRouter.post('/', async (req: any, res: Response): Promise<any> => {
    try {
        // grab all the form data from frontend
        const {
            title,
            description,
            startDate,
            startTime,
            endTime,
            venue,
            interests,
            category,
            selectedTags,
            selectedImages,
        } = req.body;
        let { cityName } = req.body;
        const userId = req.user.id;
        // console.log('we received: ', startDate);
        // console.log('and ', startTime);
        // console.log('finally ', endTime);

        // convert the date and times into proper format for db
        // const start_time = dayjs(`${startDate} ${startTime}`).format('YYYY-MM-DD HH:mm:ss');
        // const end_time = dayjs(`${startDate} ${endTime}`).format('YYYY-MM-DD HH:mm:ss');

        // check if venue exists using fsq_id
        // console.log('if statement soon');
        let eventVenue: any;
        if (venue.id) {
            // console.log('VENUE ID: ', venue.id);
            eventVenue = await Venue.findByPk(venue.id);
        } else if (venue.fsq_id) {
            // console.log('searching fsq id for venue bad way');
            eventVenue = await Venue.findOne({
                where: { fsq_id: venue.fsq_id }
            });
        }

        // create notification to remind user 1 hour before event
        const oneHourBefore = new Date(startDate);
        oneHourBefore.setHours(oneHourBefore.getHours() - 1);

        const notification: any = await Notification.create({
            message: `The upcoming event you're attending, ${title}, starts in an hour. Hope to see you there!`,
            send_time: oneHourBefore,
        });

        // create the actual event
        const newEvent: any = await Event.create({
            title,
            start_time: startDate,
            end_time: endTime,
            description,
            hour_before_notif: notification.id,
            created_by: userId,
        });

        // add user creator as an attendee
        await User_Event.create({
            UserId: userId,
            EventId: newEvent.id,
            user_attending: true
        });

        // add notification for user creator
        await User_Notification.create({
            UserId: userId,
            NotificationId: notification.id
        });

        // connect venue to event
        await newEvent.setVenue(eventVenue);

        // If there's a venue description and the venue exists
        if (venue.description && eventVenue) {
            await eventVenue.update({
                description: venue.description
            });
        }

        // find and add the category to event
        const assignCategory: any = await Category.findOne({
            where: { name: category }
        });
        if (assignCategory) {
            await newEvent.setCategory(assignCategory);
        }

        // find and add interests to event
        const findInterest: any = await Interest.findAll({
            where: { name: interests }
        });
        if (findInterest) {
            await newEvent.setInterests(findInterest);
        }

        // create chatroom for the event
        const chatroom: any = await Chatroom.create({
            map: null,
            event_id: newEvent.dataValues.id
        });
        await chatroom.setEvent(newEvent);

        // create event venue tag records
        if (selectedTags?.length > 0) {
            for (const tag of selectedTags) {
                let venueTagId = tag.id;
                
                // if this is a custom tag (no id), create it first
                if (!tag.venue_id) {
                    const newVenueTag: any = await Venue_Tag.create({
                        tag: tag.tag,
                        source: 'user',
                        count: 1,
                        venue_id: eventVenue.id
                    });
                    venueTagId = newVenueTag.id;
                }

                await Event_Venue_Tag.create({
                    EventId: newEvent.id,
                    VenueTagId: venueTagId,
                    display_order: tag.display_order
                });
            }
        }

        if (selectedImages && selectedImages.length > 0) {
            await Event_Venue_Image.bulkCreate(selectedImages.map((img: any) => ({
                EventId: newEvent.id,
                VenueImageId: img.id,
                display_order: img.display_order
            })))
        }

        // after creating the event, check for The Host flare achievement
        const user: any = await User.findByPk(userId);
        await checkForFlares(user, 'The Host');

        res.status(201).send(newEvent);
    } catch (error) {
        console.error('Error in POST to /api/event: ', error);
        res.sendStatus(500);
    }
});




eventRouter.post('/venue/create', async (req: any, res: Response) => {
    try {
        const inputVenueData = req.body;

        // build search query to find venue in google/fsq
        const searchQuery = `"${inputVenueData.name}" "${inputVenueData.street_address} ${inputVenueData.city_name} ${inputVenueData.state_name} ${inputVenueData.zip_code}"`;

        // console.log('searching with query:', searchQuery);

        // try to get google place id first
        const googlePlaceId = await getGooglePlaceId(searchQuery);
        // console.log('got google place id:', googlePlaceId);

        // if we got google id, get more data using apify
        let googleData = null;
        if (googlePlaceId) {
            // console.log('fetching google data with apify...');
            const apifyResults: any = await runApifyActor(googlePlaceId);
            // console.log('apify results:', apifyResults);
            googleData = apifyResults?.[0] || null;
            // console.log('processed google data:', {
            //     description: googleData?.description,
            //     title: googleData?.title,
            //     address: googleData?.street
            // });

            // make sure google data matches our venue
            if (googleData && !isVenueMatch(inputVenueData, googleData)) {
                // console.log('google data did not match input venue');
                googleData = null;
            }
        }

        // try to find venue in fsq
        const fsqResponse = await fetch(
            `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(searchQuery)}`,
            {
                headers: {
                    Accept: 'application/json',
                    Authorization: `${process.env.FOURSQUARE_API_KEY}`,
                },
            }
        );
        const fsqData = await fsqResponse.json();




        // find matching venue in fsq results
        const fsqVenue = fsqData.results?.find((venue: any) => isVenueMatch(inputVenueData, venue));

        // if we found fsq venue, get full details
        let fsqVenueDetails = null;
        if (fsqVenue?.fsq_id) {
            const detailsResponse = await fetch(
                `https://api.foursquare.com/v3/places/${fsqVenue.fsq_id}?fields=fsq_id,name,description,location,tel,website,tips,rating,hours,features,stats,price,photos,tastes,popularity,hours_popular,social_media,categories`,
                {
                    headers: {
                        Accept: 'application/json',
                        Authorization: `${process.env.FOURSQUARE_API_KEY}`,
                    },
                }
            );
            fsqVenueDetails = await detailsResponse.json();
        }

        // get images and tags from both apis
        const venueImages = getVenueImages(/* fsqVenueDetails, */ googleData ? [googleData] : []);
        const venueTags = getVenueTags(/* fsqVenueDetails, */ googleData ? [googleData] : []);

        // combine all the venue data we got
        const enrichedVenue = {
            ...inputVenueData,
            google_place_id: googlePlaceId || null,
            fsq_id: fsqVenue?.fsq_id || null,
            phone: googleData?.phone || fsqVenueDetails?.tel || null,
            website: googleData?.website || fsqVenueDetails?.website || null,
            wheelchair_accessible: googleData?.additionalInfo?.Accessibility ? true : null,
            rating: getVenueRating(fsqVenueDetails || {}, googleData ? [googleData] : []),
            total_reviews: getVenueReviewCount(fsqVenueDetails || {}, googleData ? [googleData] : []),
            pricing: googleData?.price || convertFSQPrice(fsqVenueDetails?.price) || null,
            serves_alcohol: getVenueAlcohol(fsqVenueDetails || {}, googleData ? [googleData] : []),
            images: venueImages || [],
            tags: venueTags || []
        };

        // save venue to our db
        const newVenue = await Venue.create(enrichedVenue);

        if (!newVenue) {
            throw new Error('Failed to create venue in database');
        }

        // convert sequelize model to plain object
        const plainVenueData = newVenue.get({ plain: true });

        // send back venue data and what fields were null
        res.json({
            venue: plainVenueData,
            nullFields: {
                description: !plainVenueData.description,
                phone: !plainVenueData.phone,
                website: !plainVenueData.website,
                rating: !plainVenueData.rating,
                total_reviews: !plainVenueData.total_reviews,
                pricing: !plainVenueData.pricing,
                popularTime: !plainVenueData.popularTime,
                wheelchair_accessible: !plainVenueData.wheelchair_accessible,
                serves_alcohol: !plainVenueData.serves_alcohol
            }
        });

    } catch (error) {
        console.error('Error in venue creation:', error);
        res.status(500).json({
            error: 'Error creating venue',
            originalData: req.body
        });
    }
});




// this route gets called when user selects a venue from fsq search results
eventRouter.get('/venue/:googlePlaceId', async (req: any, res: any) => {
    let gData: GoogleData[] = [];
    try {
        // get the fsq id from url
        const { googlePlaceId } = req.params;

        // check if we already have this venue in our db
        // const hasFSQId = await Venue.findOne({ where: { fsq_id: fsqId } });


        const existingVenue: any = await Venue.findOne({
            where: { google_place_id: googlePlaceId },
            include: [
                { model: Venue_Tag, as: 'Venue_Tags' },
                { model: Venue_Image, as: 'Venue_Images' }
            ]
        });

        if (existingVenue) {
            const nullFields: any = {};
            if (existingVenue.name === null) nullFields.name = null;
            if (existingVenue.description === null) nullFields.description = null;
            if (existingVenue.category === null) nullFields.category = null;
            if (existingVenue.street_address === null) nullFields.street_address = null;
            if (existingVenue.zip_code === null) nullFields.zip_code = null;
            if (existingVenue.city_name === null) nullFields.city_name = null;
            if (existingVenue.state_name === null) nullFields.state_name = null;
            if (existingVenue.phone === null) nullFields.phone = null;
            if (existingVenue.website === null) nullFields.website = null;
            if (existingVenue.pricing === null) nullFields.pricing = null;
            if (existingVenue.wheelchair_accessible === null) nullFields.wheelchair_accessible = null;
            if (existingVenue.serves_alcohol === null) nullFields.serves_alcohol = null;

            return res.json({
                venue: existingVenue,
                nullFields,
            });
        }
        // if venue isn't in our db, get it from fsq api
        // if (!hasFSQId) {
        //     const response = await fetch(
        //         `https://api.foursquare.com/v3/places/${fsqId}?fields=fsq_id,name,description,location,tel,website,tips,rating,hours,features,stats,price,photos,tastes,popularity,hours_popular,social_media,categories`, {
        //         headers: {
        //             Accept: 'application/json',
        //             Authorization: `${process.env.FOURSQUARE_API_KEY}`,
        //         },
        //     }
        //     );
        //     fsqData = await response.json();
        // }

        // // check if we have a google place id for this venue
        // const hasGoogleId = await Venue.findOne({
        //     where: {
        //         fsq_id: fsqId,
        //         google_place_id: {
        //             [Op.and]: [
        //                 { [Op.ne]: null },
        //                 { [Op.ne]: '' }
        //             ]
        //         }
        //     }
        // });

        // // if no google data, try to get it
        // if (!hasGoogleId) {
        //     // make sure we have enough info to search google
        //     if (fsqData?.name && fsqData?.location?.formatted_address) {
        //         try {
        //             // build search query for google
        //             const query = `"${fsqData.name}" "${fsqData.location.formatted_address}"`
        //             // get google place id
        //             googlePlaceId = await getGooglePlaceId(query);
        //             if (googlePlaceId) {
        //                 // use apify to get more google data
        //                 gData = await runApifyActor(googlePlaceId) as GoogleData[];
        //             }
        //         } catch (error) {
        //             console.error('Error getting Google Place Data: ', error);
        //         }
        //     } else {
        //         console.warn('Not enough data for Google Text Search query');
        //     }
        // }
        // if (fsqData && gData) {
        //     console.log('DATA BEGINS HERE');
        //     console.log('---------FSQ DATA')
        //     console.log(JSON.stringify(fsqData, null, 2));
        //     console.log('---------GOOGLE DATA');
        //     console.log(JSON.stringify(gData, null, 2));
        // } else if (fsqData && !gData) {
        //     console.log('ONLY FSQ DATA WAS FOUND');
        // } else {
        //     console.log('NO DATA WAS FOUND');
        // }

        // // @ts-ignore
        // console.log('DOGS ALLOWED:', gData[0]?.additionalInfo?.Pets?.some(pet => pet?.['Dogs allowed']));
        // // @ts-ignore
        // console.log('DOG FRIENDLY: ', fsqData?.tastes.includes('dog-friendly'));
        // // @ts-ignore
        // console.log('DOG FRIENDLY 2: ', fsqData?.tastes.includes('dog runs'));
        // // @ts-ignore
        // console.log('DOG PARK: ', gData[0]?.additionalInfo?.Pets?.some(pet => pet?.['Dog park']));

        gData = await runApifyActor(googlePlaceId) as GoogleData[];

        const searchParams = new URLSearchParams({
            place_id: googlePlaceId,
            key: 'AIzaSyDNPSQ37dyK5nHAbh5llxirC3tBRDytyCU'
        });

        const venueResponse = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?${searchParams}`
        );

        const venueData = await venueResponse.json();

        // combine all the venue data we got
        const buildVenue: VenueType = {
            id: null,
            name: venueData.result.name || null,
            description: venueData.result.editorial_summary ? venueData.result.editorial_summary.overview : null,
            category: gData?.[0]?.categoryName || null,
            street_address: venueData.formatted_address || null,
            zip_code: +(venueData.result.address_components[7].long_name) || gData?.[0]?.postalCode || null,
            city_name: venueData.result.address_components[3].long_name || gData?.[0]?.city || null,
            state_name: venueData.result.address_components[5].short_name || null,
            phone: venueData.result.formatted_phone_number || null,
            website: venueData.result.website || gData?.[0]?.website || null,
            rating: venueData.result.rating || null,
            total_reviews: venueData.result.reviews.length || null,
            pricing: gData?.[0]?.price || null,
            popularTime: getPopularTime(gData) || null,
            wheelchair_accessible: getVenueAccessibility(gData) || null,
            serves_alcohol: venueData.result.serves_beer || null,
            is_vegan_friendly: getVenueVeganFriendly(gData),
            is_dog_friendly: getVenueDogFriendly(gData),
            fsq_id: null,
            google_place_id: googlePlaceId || null,
        };
        // console.log('BUILD VENUE: ', buildVenue);
        // save venue to our db
        const newVenue: any = await Venue.create(buildVenue);

        // track which fields are null for the review page
        const nullFields: any = {};
        if (newVenue) {
            if (newVenue.name === null) nullFields.name = null;
            if (newVenue.description === null) nullFields.description = null;
            if (newVenue.category === null) nullFields.category = null;
            if (newVenue.street_address === null) nullFields.street_address = null;
            if (newVenue.zip_code === null) nullFields.zip_code = null;
            if (newVenue.city_name === null) nullFields.city_name = null;
            if (newVenue.state_name === null) nullFields.state_name = null;
            if (newVenue.phone === null) nullFields.phone = null;
            if (newVenue.website === null) nullFields.website = null;
            if (newVenue.pricing === null) nullFields.pricing = null;
            if (newVenue.wheelchair_accessible === null) nullFields.wheelchair_accessible = null;
            if (newVenue.serves_alcohol === null) nullFields.serves_alcohol = null;
            if (newVenue.is_dog_friendly === null) nullFields.is_dog_friendly = null;
            if (newVenue.is_vegan_friendly === null) nullFields.is_vegan_friendly = null;
        }

        // get and save venue tags
        const newTags = getVenueTags(gData);
        if (newTags) {
            await Venue_Tag.bulkCreate(newTags.map((tag) => ({
                ...tag,
                venue_id: newVenue.id
            })));
        }

        // get and save venue images
        const newImages = getVenueImages(gData);

        if (newImages) {
            await Venue_Image.bulkCreate(newImages.map(image => ({
                ...image,
                venue_id: newVenue.id
            })));
        }

        const googlePlacePhotos = [];

        for (let photo of venueData.result.photos) {
            const photoSearchParams = new URLSearchParams({
                maxWidthPx: '400',
                key: `${process.env.GOOGLE_PLACES_API_KEY}`
            });

            const response = await fetch(`https://places.googleapis.com/v1/places/${googlePlaceId}/photos/${photo.photo_reference}/media?${photoSearchParams}`);
            
            googlePlacePhotos.push({
                path: response.url,
                source: 'google',
                venue_id: newVenue.id
            });
        }

        if (googlePlacePhotos.length) {
            await Venue_Image.bulkCreate(googlePlacePhotos);
        }


        const completeVenue = await Venue.findOne({
            where: { id: newVenue.id },
            include: [
                { model: Venue_Image, as: 'Venue_Images' }
            ]
        });

        // send back venue data and null fields
        const buildResponse = {
            venue: completeVenue,
            nullFields,
        };

        res.json(buildResponse);
    } catch (error) {
        console.error('Error creating venue record in DB', error);
        res.sendStatus(500);
    }
})

// this route handles when users update venue info on the review page
eventRouter.put('/venue/:id/:field', async (req: any, res: Response) => {
    try {
        const { id, field } = req.params;
        const { userId } = req.body;
        const updateData = { [field]: req.body[field] };

        // update the venue field
        await Venue.update(updateData, { where: { id } });

        // get user to check for flare achievement
        const user: any = await User.findByPk(userId);
        await checkForFlares(user, 'Venue Virtuoso');

        res.sendStatus(200);
    } catch (error) {
        console.error('Error updating venue field:', error);
        res.sendStatus(500);
    }
});

// get all categories for the category dropdown in create event form
eventRouter.get('/categories', async (req: Request, res: Response) => {
    try {
        const categories: any[] = await Category.findAll();
        const data = categories.map(category => ({
            name: category.dataValues.name,
            id: category.dataValues.id
        }));
        res.status(200).send(data);
    } catch (err: any) {
        console.error('Failed to GET /categories:', err);
        res.sendStatus(500);
    }
});

// get all venues in our db - DEPRECATED (fields need to be udpated, but this is never used so)
eventRouter.get('/venues', async (req: Request, res: Response) => {
    try {
        const venues = await Venue.findAll();
        const data = venues.map(venue => ({
            name: venue.dataValues.name,
            description: venue.dataValues.description,
            street_address: venue.dataValues.street_address,
            zip_code: venue.dataValues.zip_code,
            city_name: venue.dataValues.city_name,
            state_name: venue.dataValues.state_name,
        }));
        res.status(200).send(data);
    } catch (error) {
        console.error('Error fetching venues from DB', error);
        res.sendStatus(500);
    }
})

export default eventRouter;
