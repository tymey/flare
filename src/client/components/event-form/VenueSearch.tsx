import React from 'react';
import { useState, useEffect} from 'react';
import {Input} from '@/components/ui/input';
import {Card} from '@/components/ui/card';
import {Ripple} from '@/components/ui/ripple';
import {Separator} from '@/components/ui/seperator';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Search, Loader2 } from "lucide-react";

function VenueSearch({ handleVenueSelect }) {
    const [venueSearch, setVenueSearch] = useState('');
    const [filteredVenues, setFilteredVenues] = useState([]);
    const [isLoadingVenue, setIsLoadingVenue] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [geoLocation, setGeoLocation] = useState(null);
    const [newVenue, setNewVenue] = useState({
        name: '',
        street_address: '',
        city_name: '',
        state_name: '',
        zip_code: ''
    });
    const [loadingMessage, setLoadingMessage] = useState(0);
    
    const loadingMessages = [
        "Checking the venue's vibe rating...",
        "Making sure it's flare-worthy...",
        "Calculating the fun factor...",
        "Measuring the memory potential..."
    ];

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setGeoLocation({ latitude, longitude });
                },
                (error) => {
                    console.error('Error getting location: ', error);
                }
            );
        }
        setVenueSearch('');
        setFilteredVenues([]);
        setIsLoadingVenue(false);
    }, []);

    // change loading message every 5 seconds
    useEffect(() => {
        if (isLoadingVenue) {
            const interval = setInterval(() => {
                setLoadingMessage((prev) => (prev + 1) % loadingMessages.length);
            }, 5000); 

            return () => clearInterval(interval);
        }
    }, [isLoadingVenue]);

    const handleVenueSearch = async (searchTerm) => {
        try {
            setVenueSearch(searchTerm);
            // if (!geoLocation) {
            //     return;
            // }

            const params = {
                searchInput: searchTerm,
                // latitude: geoLocation.latitude,
                // longitude: geoLocation.longitude
            };

            const response = await axios.get('/api/event/search', { params });
            setFilteredVenues(response.data);
        } catch (error) {
            console.error('Error searching venues: ', error);
        }
    };

    const onVenueSelect = async (venue) => {
        console.log('onVenueSelect called with venue:', venue);
        console.log('venue type:', typeof venue);
        
        if (!venue) {
            console.error('venue object is undefined');
            return;
        }
        
        setIsLoadingVenue(true);
        
        try {
            // console.log('venue.id:', venue.id);
            // console.log('venue.fsq_id:', venue.fsq_id);
            
            if (venue.id) {
                // console.log('Using venue from database with id:', venue.id);
                await handleVenueSelect(venue);
            } 
            else if (venue.place_id) {
                // console.log('Fetching venue details for fsq_id:', venue.fsq_id);
                try {
                    const response = await axios.get(`/api/event/venue/${venue.place_id}`);
                    // console.log('API response:', response.data);
                    await handleVenueSelect(response.data);
                } catch (error) {
                    console.error('error fetching venue details:', error);
                    // console.log('Falling back to original venue data');
                    await handleVenueSelect(venue);
                }
            } 
            else {
                // console.log('Using fallback case for venue with no id or fsq_id');
                await handleVenueSelect(venue);
            }
        } catch (error) {
            console.error('error in onVenueSelect:', error);
        } finally {
            setIsLoadingVenue(false);
        }
    };

    const handleCreateVenue = async () => {
        setIsCreating(true);
        try {
            // format the query for gData
            const query = `"${newVenue.name}" "${newVenue.street_address} ${newVenue.city_name} ${newVenue.state_name} ${newVenue.zip_code}"`;

            // If venue doesn't exist, create it
            setIsLoadingVenue(true);
            const { data } = await axios.post('/api/event/venue/create', {
                ...newVenue,
                query
            });

            if (!data || !data.venue) {
                throw new Error('No venue data received');
            }

            // pass data to handleVenueSelect
            await handleVenueSelect(data);  // data already contains {venue, nullFields}

            setVenueSearch('');
            setNewVenue({
                name: '',
                street_address: '',
                city_name: '',
                state_name: '',
                zip_code: ''
            });
        } catch (error) {
            console.error('Error creating venue:', error);
        } finally {
            setIsCreating(false);
            setIsLoadingVenue(false);
        }
    };

    return (
        <div className="flex-1">
            <div className="p-6 border-b border-orange-500/20">
                <h2 className="text-xl font-bold bg-gradient-to-r from-yellow-500 via-orange-500 to-pink-500 bg-clip-text text-transparent mb-2">
                    Choose or Create Venue
                </h2>
                <p className="text-sm text-gray-400">
                    Choose where your story unfolds
                </p>
            </div>

            <div className="p-6">
                <Tabs defaultValue="search" className="space-y-4">
                    <TabsList className="grid grid-cols-2 bg-black/50">
                        <TabsTrigger 
                            value="search" 
                            className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-white hover:text-white"
                        >
                            <Search className="w-4 h-4 mr-2" />
                            Search Venues
                        </TabsTrigger>
                        <TabsTrigger 
                            value="create" 
                            className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-white hover:text-white"
                        >
                            <PlusCircle className="w-4 h-4 mr-2" />
                            Create New
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="search" className="space-y-4">
                        <div className="relative">
                            <Input
                                placeholder="Search for a venue..."
                                value={venueSearch}
                                onChange={(e) => handleVenueSearch(e.target.value)}
                                className="bg-black/80 border-orange-500/30 focus:ring-2 focus:ring-orange-500/50 text-white placeholder-gray-400"
                            />

                            {isLoadingVenue && (
                                <div className="fixed inset-0 flex items-center justify-center z-50">
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
                                    <Card className="relative w-64 h-64 bg-gradient-to-br from-gray-900/90 to-black/90 border border-orange-500/30">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Ripple
                                                className="opacity-100"
                                                mainCircleSize={100}
                                                mainCircleOpacity={0.4}
                                                numCircles={6}
                                                speed={1.5}
                                                color="rgb(249, 115, 22)"
                                            />
                                        </div>
                                        <div className="relative z-10 h-full flex flex-col items-center justify-center">
                                            <h3 className="text-lg font-medium text-white">
                                                Just a moment...
                                            </h3>
                                            <p className="text-sm text-gray-300 mt-2 text-center px-4">
                                                {loadingMessages[loadingMessage]}
                                            </p>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {venueSearch && filteredVenues.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-gray-900/95 border border-orange-500/30 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {filteredVenues.map((venue, index) => (
                                        <div
                                            key={index}
                                            className="p-3 hover:bg-orange-500/30 cursor-pointer border-b border-orange-500/20 last:border-b-0"
                                            onClick={() => onVenueSelect(venue)}
                                        >
                                            <div className="font-medium text-white">{venue.name}</div>
                                            <div className="text-sm text-gray-300">
                                                {venue.street_address}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {venueSearch && filteredVenues.length === 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-gray-900/95 border border-orange-500/30 rounded-md shadow-lg p-3 text-gray-300">
                                    No venues found. Would you like to create a new venue?
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="create" className="space-y-4">
                        <div className="space-y-4">
                            <Input
                                placeholder="Venue Name"
                                value={newVenue.name}
                                onChange={(e) => setNewVenue(prev => ({ ...prev, name: e.target.value }))}
                                className="bg-black/80 border-orange-500/30 focus:ring-2 focus:ring-orange-500/50 text-white"
                            />
                            <Input
                                placeholder="Street Address"
                                value={newVenue.street_address}
                                onChange={(e) => setNewVenue(prev => ({ ...prev, street_address: e.target.value }))}
                                className="bg-black/80 border-orange-500/30 focus:ring-2 focus:ring-orange-500/50 text-white"
                            />
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <Input
                                    placeholder="City"
                                    value={newVenue.city_name}
                                    onChange={(e) => setNewVenue(prev => ({ ...prev, city_name: e.target.value }))}
                                    className="bg-black/80 border-orange-500/30 focus:ring-2 focus:ring-orange-500/50 text-white"
                                />
                                <Input
                                    placeholder="State"
                                    value={newVenue.state_name}
                                    onChange={(e) => setNewVenue(prev => ({ ...prev, state_name: e.target.value }))}
                                    className="bg-black/80 border-orange-500/30 focus:ring-2 focus:ring-orange-500/50 text-white"
                                />
                                <Input
                                    placeholder="ZIP Code"
                                    value={newVenue.zip_code}
                                    onChange={(e) => setNewVenue(prev => ({ ...prev, zip_code: e.target.value }))}
                                    className="bg-black/80 border-orange-500/30 focus:ring-2 focus:ring-orange-500/50 text-white col-span-2 sm:col-span-1"
                                />
                            </div>
                            <Button
                                className="w-full bg-orange-500 hover:bg-orange-600"
                                onClick={handleCreateVenue}
                                disabled={!newVenue.name || !newVenue.street_address || isCreating || isLoadingVenue}
                            >
                                {(isCreating || isLoadingVenue) ? (
                                    <span className="flex items-center">
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        {isCreating ? 'Creating...' : 'Loading...'}
                                    </span>
                                ) : (
                                    <>
                                        <PlusCircle className="w-4 h-4 mr-2" />
                                        Create Venue
                                    </>
                                )}
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

export default VenueSearch;