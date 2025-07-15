import {type VenueImage, type AlcoholData, type GoogleData, type FSQData, type VenueTag,}
    from '../src/types/Venues';
import dayjs from 'dayjs';
import {ApifyClient} from 'apify-client';



export const getVenueDogFriendly = (/* fsqData: any, */ gData: any) => {
    // if (fsqData?.tastes?.includes('dog-friendly')) return true;
    // if (fsqData?.tastes?.includes('dog runs')) return true;

    if (gData?.[0]?.additionalInfo?.Pets) {
        const pets = gData[0].additionalInfo.Pets;
        for (const pet of pets) {
            if (pet['Dogs allowed'] || pet['Dog park']) {
                return true;
            }
        }
    }

    return null;
}

export const getVenueVeganFriendly = (/* fsqData: any, */ gData: any) => {
    // if (fsqData?.features?.attributes?.vegan_diet) return true;
    if (gData?.[0]?.attributes?.vegan_diet) return true;
    if (gData?.[0]?.categories?.some((category: any) => 
        category.toLowerCase().includes('vegan'))) return true;
    if (gData?.[0]?.additionalInfo?.Offerings?.some((offering: any) => 
        offering['Vegan options'])) return true;

    return null;
}


// helper function to check if venue from api matches user input
export const isVenueMatch = (inputVenue: any, apiVenue: any): boolean => {
    // console.log('checking venue match:');
    // console.log('input:', {
    //     name: inputVenue.name,
    //     address: inputVenue.street_address
    // });
    // console.log('api:', {
    //     name: apiVenue.name || apiVenue.title,
    //     address: apiVenue.location?.address || apiVenue.street
    // });

    // clean up venue names and addresses for comparison
    const inputName = inputVenue.name.toLowerCase().trim();
    const inputAddress = inputVenue.street_address.toLowerCase().trim();

    const apiName = apiVenue.name?.toLowerCase().trim() ||
        apiVenue.title?.toLowerCase().trim();
    const apiAddress = apiVenue.location?.address?.toLowerCase().trim() ||
        apiVenue.street?.toLowerCase().trim();

    // console.log('comparison:', {
    //     nameMatch: inputName === apiName,
    //     addressMatch: inputAddress === apiAddress,
    //     inputName,
    //     apiName,
    //     inputAddress,
    //     apiAddress
    // });

    return inputName === apiName && inputAddress === apiAddress;
}



// remove duplicate venues helper function - used to remove duplicates from user venue autocomplete search
export const removeDuplicateVenues = (venues: any) => {
    // object to track venues using name and street address keys
    const seen: any = {};
    // return filtered array without duplicate venues
    return venues.filter((venue: { name: any; street_address: any; }) => {
        // check for duplicates by creating keys (name and street address of venue)
        const key: any = `${venue.name} - ${venue.street_address}`;
        // check if key has been added to our seen object
        if (seen.hasOwnProperty(key)) {
            // if seen object has venue key, return false - do not add to array
            return false;
            // if key is not found in seen, add it and set value to true
        } else {
            seen[key] = true;
            return true;
        }
    })
}

// apify worker/actor that receives a Google Place Id and returns Google Business Data (scrapes data from Google My Business) - uses the Apify SDK
export const runApifyActor = async (googlePlaceId: any) => {
    try {
        // console.log('initializing apify client...');
        const client = new ApifyClient({
            token: process.env.APIFY_API_KEY,
        });

        // console.log('calling apify actor with place id:', googlePlaceId);
        // calls our Apify actor 'compass/google-places-api'
        const run = await client.actor("compass/google-places-api").call({
            placeIds: [`place_id:${googlePlaceId}`]
        });

        // console.log('got apify run result:', run);
        // after our Apify actor runs, it returns various meta data
        const {items} = await client.dataset(run.defaultDatasetId).listItems();
        // console.log('apify items:', items);
        
        return items;

    } catch (error) {
        console.error('Error running Apify Actor', error);
        return error;
    }
}

// google text search api request - receives venue name and street address, returns the goooglePlaceId
export const getGooglePlaceId = async (query: any) => {
    try {
        // const query = `"${venueData.name}" "${venueData.location.formatted_address}"` // wrap in quotes to apply added weight to location and name (avoids server locale having priority weights when searching)
        const googlePlacesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${process.env.GOOGLE_PLACES_API_KEY}`
        const response = await fetch(googlePlacesUrl)
        const data = await response.json();
        if (data.results && data.results.length > 0 && data.results[0].place_id) {
            return data.results[0].place_id;
        }
        // if no results are found, log and return null
        console.warn('No Google Place results found for query: ', query);
        return null;
    } catch (error) {
        console.error(`Error getting Google Place Id for Venue. ERROR: ${error}`);
        return null;
    }
}

// convert fsq price number range to match gData
export const convertFSQPrice = (price: any): string | null => {
    if (typeof price === 'string' && price.startsWith('$')) {
        return price;
    }
    const formatPrice = Number(price);
    switch (formatPrice) {
        case 1:
            return '$1-10';
        case 2:
            return '$10-20';
        case 3:
            return '$20-30';
        case 4:
            return '$30-40';
        case 5:
            return '$40-50';
        default:
            return null;
    }
}


// collect venue hashtags from various locations in api res - saves the # of occurrences for each tag and combines them across data providers, deduplicates
export const getVenueTags = (/* fsqData: FSQData, */ gData: GoogleData[]): VenueTag[] | null => {
    let tags: Array<VenueTag> = [];
    // if (fsqData?.tastes) {
    //     fsqData.tastes.forEach(taste => {
    //         let exists = false;
    //         for (let i = 0; i < tags.length; i++) {
    //             if (tags[i].tag === taste.toLowerCase()) {
    //                 tags[i].count += 1;
    //                 exists = true;
    //             }
    //         }
    //         if (!exists) {
    //             tags.push({
    //                 tag: taste.toLowerCase(),
    //                 source: 'foursquare',
    //                 count: 1
    //             });
    //         }
    //     });
    // }
    if (gData?.[0]?.reviewsTags) {
        gData[0].reviewsTags.forEach(reviewTag => {
            if (reviewTag.title && reviewTag.count) {
                let exists = false;
                for (let i = 0; i < tags.length; i++) {
                    if (tags[i].tag === reviewTag.title.toLowerCase()) {
                        tags[i].count += reviewTag.count;
                        exists = true;
                    }
                }
                if (!exists) {
                    tags.push({
                        tag: reviewTag.title.toLowerCase(),
                        source: 'google',
                        count: reviewTag.count
                    });
                }
            }
        });
    }
    if (gData?.[0]?.placesTags) {
        gData[0].placesTags.forEach(placeTag => {
            if (placeTag.title && placeTag.count) {
                let exists = false;
                for (let i = 0; i < tags.length; i++) {
                    if (tags[i].tag === placeTag.title.toLowerCase()) {
                        tags[i].count += placeTag.count;
                        exists = true;
                    }
                }
                if (!exists) {
                    tags.push({
                        tag: placeTag.title.toLowerCase(),
                        source: 'google',
                        count: placeTag.count
                    });
                }
            }
        });
    }
    return tags.length > 0 ? tags : null; // return
}

// format state to 2 char all cap format for saving to db
export const formatState = (fsqData: FSQData, gData: GoogleData[]) => {
    let input;
    if (fsqData?.location?.region) {
        input = fsqData.location.region;
    } else if (gData[0]?.state) {
        input = gData[0]?.state;
    } else {
        return null;
    }
    const states: Record<string, string> = {
        'arizona': 'AZ',
        'alabama': 'AL',
        'alaska': 'AK',
        'arkansas': 'AR',
        'california': 'CA',
        'colorado': 'CO',
        'connecticut': 'CT',
        'delaware': 'DE',
        'florida': 'FL',
        'georgia': 'GA',
        'hawaii': 'HI',
        'idaho': 'ID',
        'illinois': 'IL',
        'indiana': 'IN',
        'iowa': 'IA',
        'kansas': 'KS',
        'kentucky': 'KY',
        'louisiana': 'LA',
        'maine': 'ME',
        'maryland': 'MD',
        'massachusetts': 'MA',
        'michigan': 'MI',
        'minnesota': 'MN',
        'mississippi': 'MS',
        'missouri': 'MO',
        'montana': 'MT',
        'nebraska': 'NE',
        'nevada': 'NV',
        'new hampshire': 'NH',
        'new jersey': 'NJ',
        'new mexico': 'NM',
        'new york': 'NY',
        'north carolina': 'NC',
        'north dakota': 'ND',
        'ohio': 'OH',
        'oklahoma': 'OK',
        'oregon': 'OR',
        'pennsylvania': 'PA',
        'rhode island': 'RI',
        'south carolina': 'SC',
        'south dakota': 'SD',
        'tennessee': 'TN',
        'texas': 'TX',
        'utah': 'UT',
        'vermont': 'VT',
        'virginia': 'VA',
        'washington': 'WA',
        'west virginia': 'WV',
        'wisconsin': 'WI',
        'wyoming': 'WY'
    };
    const normalizedInput = input.toLowerCase().trim();
    if (Object.values(states).includes(input)) return input; // if input is already formatted properly
    return states[normalizedInput] || null
}

// search for alcohol data
export const getVenueAlcohol = (fsqData: FSQData, gData: GoogleData[]): boolean | null => {
    // init array of search queries
    const searchQueries = ['Cocktail', 'Bar', 'cocktails', 'full_bar', 'Great cocktails', 'Great wine list', 'Alcohol', 'Beer', 'Cocktails', 'Hard liquor', 'Wine', 'Bar onsite', 'Great beer selection', 'Great cocktails', 'Spirits', 'Happy-hour drinks',];
    // direct search for potential quick exit
    if (fsqData?.categories?.[0]?.short_name && searchQueries.includes(fsqData.categories[0].short_name) || gData[0]?.categories?.includes('Bar')) return true;
    // create obj of kvp's from objs that contain relevant data
    const alcoholData: AlcoholData = {
        ...(fsqData?.features?.food_and_drink?.alcohol || {}),
        ...(gData[0]?.additionalInfo?.Highlights || {}),
        ...(gData[0]?.additionalInfo?.Offerings || {}),
        ...(gData[0]?.additionalInfo?.Amenities || {}),
        ...(fsqData?.categories?.[0] || {}),
    }
    // iterate through obj searching for a searchQuery that has true value
    for (let key in alcoholData) {
        if (searchQueries.includes(key) && alcoholData[key]) {
            return true;
        }
    }
    return null;
};

// accumulate venue ratings from both apis
export const getVenueRating = (fsqData: FSQData, gData: GoogleData[]) => {
    if (fsqData?.rating && gData[0]?.totalScore) {
        const fsqRating = fsqData?.rating * 0.5; // convert to same range as gData
        const gRating = gData[0]?.totalScore;
        return Number((fsqRating + gRating) / 2).toFixed(1); // return value matching gData rating format
    } else if (fsqData?.rating && !gData[0]?.totalScore) {
        const fsqRating = fsqData?.rating * 0.5;
        return Number(fsqRating).toFixed(1);
    } else if (!fsqData?.rating && gData[0]?.totalScore) {
        return gData[0].totalScore;
    } else {
        return null;
    }
}


// convert gData histogram to day and hour for busiest time
export const getPopularTime = (gData: GoogleData[]) => {
    // convert google popular time histogram into most popular day and hour - may eventually want to change this to save more data in the future
    if (gData.length > 0) { // Check if gData has elements
        let mostBusy = 0;
        let peakDay: any = '';
        let peakHour = 0;
        // iterate over through object
        for (const data of gData) {
            // check if populartimeshistogram data exists
            if (data.popularTimesHistogram) {
                for (const day in data.popularTimesHistogram) {
                    // get array of hours for current day
                    const hours = data.popularTimesHistogram[day];
                    // iterate through each hour in day
                    hours.forEach((hourData: any) => {
                        // update variables
                        if (hourData.occupancyPercent > mostBusy) {
                            mostBusy = hourData.occupancyPercent;
                            peakDay = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].indexOf(day);
                            peakHour = hourData.hour;
                        }
                    });
                }
            }
        }
        const date = dayjs().day(peakDay).hour(peakHour);
        return date.toDate();
    }
    return null;
}

// format phone number to 1234567890 format
export const formatPhoneNumber = (fsqData: FSQData, gData: GoogleData[]) => {
    let phoneNumber;
    // reassign phoneNumber to api res value
    if (fsqData?.tel) {
        phoneNumber = fsqData.tel;
    } else if (gData[0]?.phone) {
        phoneNumber = gData[0].phone;
    } else if (gData[0]?.phoneUnformatted) {
        phoneNumber = gData[0].phoneUnformatted;
    } else {
        return null;
    }
    // remove non digit chars
    const cleaned = ('' + phoneNumber).replace(/\D/g, '');
    // check the cleaned format to ensure its valid (optional leading 1, three digits, next three digits, and last four digits)
    const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
    // if valid
    if (match) {
        return cleaned;
    }
    return null;
}

// check if gData has truthy accessibility values for wheelchair keys
export const getVenueAccessibility = (gData: GoogleData[]) => {
    if (!gData?.[0]?.additionalInfo?.Accessibility) return null;
    for (let item of gData[0].additionalInfo.Accessibility) {
        for (let key in item) {
            if (key.includes('Wheelchair') && item[key]) {
                return true;
            }
        }
    }
    return null;
}


// accumulate total number of reviews
export const getVenueReviewCount = (fsqData: FSQData, gData: GoogleData[]) => {
    let count = 0;
    if (fsqData?.stats?.total_ratings) {
        count += fsqData.stats.total_ratings;
    }
    if (gData?.[0]?.reviewsCount) {
        count += gData[0].reviewsCount;
    }
    return count || null; // return null if count is 0 (falsey)
}

// accumulate venue images from api responses
export const getVenueImages = (/* fsqData: FSQData, */ gData: GoogleData[]): VenueImage[] | null => {
    let images: VenueImage[] = [];
    // if (fsqData?.photos) {
    //     fsqData.photos.forEach((photo) => {
    //         images.push({
    //             path: `${photo.prefix}original${photo.suffix}`, // fsq data requires size format inbetwen prefix and suffix
    //             source: 'foursquare', // keep source to compare image quality across data providers
    //         })
    //     })
    // }

    // do the same with gData
    if (gData?.[0]?.imageUrl) {
        images.push({
            path: gData[0].imageUrl,
            source: 'google'
        })
    }
    // return array of image objs or null
    return images.length > 0 ? images : null;
}
