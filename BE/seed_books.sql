-- seed_books.sql — expands the catalogue to 40+ titles across all nine genres.
-- Safe to re-run: every insert is guarded, so nothing duplicates.
-- Every cover_url was checked to return a real image from openlibrary.org;
-- ?default=false makes a missing cover 404 so the app falls back to its
-- coloured placeholder instead of showing a blank white box.

BEGIN;

CREATE TEMP TABLE incoming (
  title       VARCHAR(255),
  author      VARCHAR(255),
  publisher   VARCHAR(255),
  genre       VARCHAR(100),
  year        INT,
  pages       INT,
  price       NUMERIC(8,2),
  stock       INT,
  cover_color VARCHAR(20),
  isbn        VARCHAR(20),
  description TEXT
) ON COMMIT DROP;

INSERT INTO incoming VALUES
-- ─── SCIENCE FICTION ───
('Foundation','Isaac Asimov','Gnome Press','Science Fiction',1951,255,15.90,6,'#1b2f4a','9780553293357','A mathematician predicts the fall of an empire and plants a seed to shorten the dark age.'),
('Neuromancer','William Gibson','Ace Books','Science Fiction',1984,271,17.50,5,'#132a2a','9780441569595','A burned-out hacker takes one last job in a world of black ice and orbital money.'),
('The Left Hand of Darkness','Ursula K. Le Guin','Ace Books','Science Fiction',1969,304,16.40,4,'#20364a','9780441478125','An envoy on a frozen world where people have no fixed sex learns what loyalty costs.'),
('Fahrenheit 451','Ray Bradbury','Ballantine Books','Science Fiction',1953,194,13.90,8,'#5a1f14','9781451673319','A fireman whose job is burning books begins to wonder what is inside them.'),
('Brave New World','Aldous Huxley','Chatto & Windus','Science Fiction',1932,311,14.60,6,'#2a3a56','9780060850524','Everyone is happy, engineered and asleep — until someone refuses the dose.'),
('The Time Machine','H.G. Wells','Heinemann','Science Fiction',1895,118,11.90,7,'#1f3340','9780451530578','A traveller rides forward to the year 802,701 and finds what became of us.'),

-- ─── FANTASY ───
('The Hobbit','J.R.R. Tolkien','Allen & Unwin','Fantasy',1937,310,14.90,9,'#2f4a2f','9780547928227','A comfortable hobbit is bustled out of his door and into a dragon''s story.'),
('The Fellowship of the Ring','J.R.R. Tolkien','Allen & Unwin','Fantasy',1954,423,18.90,7,'#24402c','9780547928210','Nine walkers set out to unmake a ring that wants very much to be found.'),
('A Wizard of Earthsea','Ursula K. Le Guin','Parnassus Press','Fantasy',1968,183,13.40,5,'#1e3a4a','9780553383041','A gifted boy summons something he cannot name, and must chase it to the world''s edge.'),
('Good Omens','Terry Pratchett','Gollancz','Fantasy',1990,288,15.90,6,'#4a3a1f','9780060853983','An angel and a demon rather like Earth and would prefer the apocalypse be cancelled.'),
('The Name of the Wind','Patrick Rothfuss','DAW Books','Fantasy',2007,662,19.90,5,'#3a2a1a','9780756404741','A living legend sits down in a quiet inn to tell the truth about himself.'),
('Mort','Terry Pratchett','Gollancz','Fantasy',1987,272,13.90,6,'#2a2a3a','9780552131063','Death takes an apprentice, with the results you would expect.'),

-- ─── HORROR ───
('Frankenstein','Mary Shelley','Lackington','Horror',1818,280,13.50,6,'#2a2a2a','9780486282114','A student builds a man out of parts and then refuses to look after him.'),
('The Shining','Stephen King','Doubleday','Horror',1977,447,17.90,5,'#4a1a1a','9780307743657','A winter caretaker, an empty hotel, and a boy who sees more than he should.'),
('It','Stephen King','Viking Press','Horror',1986,1138,22.90,4,'#3a1010','9781501142970','Seven friends promise to come back if it ever returns. It returns.'),

-- ─── CLASSIC ───
('Moby-Dick','Herman Melville','Harper & Brothers','Classic',1851,635,18.50,4,'#1a2c40','9780142437247','One man''s war with a whale, and everyone else''s misfortune to be aboard.'),
('Crime and Punishment','Fyodor Dostoevsky','Penguin Books','Classic',1866,671,17.90,5,'#3a1a24','9780140449136','A student commits the perfect murder and spends the rest of the book confessing.'),
('The Great Gatsby','F. Scott Fitzgerald','Scribner','Classic',1925,180,13.90,7,'#1a3a4a','9780743273565','A man throws enormous parties in the hope one guest will walk in.'),
('The Catcher in the Rye','J.D. Salinger','Little, Brown','Classic',1951,234,14.50,6,'#7a2a1a','9780316769488','Three days in New York with a boy who finds everyone phony, himself included.'),

-- ─── MYSTERY ───
('Murder on the Orient Express','Agatha Christie','Collins Crime Club','Mystery',1934,256,14.90,7,'#2a1a3a','9780062693662','A train stuck in snow, a body in compartment one, and twelve suspects.'),
('And Then There Were None','Agatha Christie','Collins Crime Club','Mystery',1939,272,14.50,6,'#1a1a2a','9780062073488','Ten strangers on an island, and a rhyme that keeps coming true.'),
('The Hound of the Baskervilles','Arthur Conan Doyle','Penguin Books','Mystery',1902,256,12.90,8,'#243a2a','9780140437867','A family curse, a moor at night, and a dog that leaves prints too large.'),

-- ─── ROMANCE ───
('Pride and Prejudice','Jane Austen','Penguin Books','Romance',1813,432,13.90,9,'#4a2a3a','9780141439518','Two people decide they cannot stand each other and are wrong about it.'),
('Jane Eyre','Charlotte Bronte','Penguin Books','Romance',1847,532,15.40,6,'#3a2432','9780141441146','A governess refuses to be small, even when love asks her to be.'),
('Wuthering Heights','Emily Bronte','Penguin Books','Romance',1847,416,14.90,5,'#2c2438','9780141439556','Love as weather: it ruins the house and everyone in it.'),
('Anna Karenina','Leo Tolstoy','Penguin Books','Romance',1878,864,19.50,4,'#3a1f2a','9780143035008','A woman risks everything, and Russia takes notes.'),

-- ─── HISTORY ───
('Sapiens','Yuval Noah Harari','Harper','History',2011,443,19.90,8,'#8a5a2a','9780062316097','How an unremarkable ape talked itself into running the planet.'),
('SPQR','Mary Beard','Liveright','History',2015,606,21.50,5,'#7a2a20','9781631492228','A thousand years of Rome, told without the marble polish.'),
('Guns, Germs, and Steel','Jared Diamond','W. W. Norton','History',1997,480,18.90,6,'#4a3a20','9780393317558','Why history handed some continents so much more than others.'),

-- ─── SCIENCE ───
('A Brief History of Time','Stephen Hawking','Bantam Books','Science',1988,212,16.50,7,'#0a1a40','9780553380163','Black holes, the beginning, and the shape of time — in plain words.'),
('The Selfish Gene','Richard Dawkins','Oxford University Press','Science',1976,360,17.40,5,'#1a3a2a','9780198788607','Bodies are what genes build to carry themselves forward.'),
('Silent Spring','Rachel Carson','Houghton Mifflin','Science',1962,368,15.90,6,'#20401f','9780618249060','The book that noticed the birds had stopped singing, and started a movement.'),

-- ─── COMEDY ───
('Three Men in a Boat','Jerome K. Jerome','J.W. Arrowsmith','Comedy',1889,185,11.90,8,'#2a4a4a','9780140012132','Three friends and a dog row up the Thames and accomplish nothing beautifully.'),
('Catch-22','Joseph Heller','Simon & Schuster','Comedy',1961,453,17.90,5,'#4a4a1a','9781451626650','You can be grounded for insanity, but asking proves you are sane.');

-- authors and publishers the catalogue does not know yet
INSERT INTO authors (name)    SELECT DISTINCT author    FROM incoming ON CONFLICT DO NOTHING;
INSERT INTO publishers (name) SELECT DISTINCT publisher FROM incoming ON CONFLICT DO NOTHING;

-- the books themselves
INSERT INTO books (title, description, pages, year, price, stock, cover_color, cover_url, publisher_id, genre_id)
SELECT i.title, i.description, i.pages, i.year, i.price, i.stock, i.cover_color,
       'https://covers.openlibrary.org/b/isbn/' || i.isbn || '-L.jpg?default=false',
       p.id, g.id
FROM incoming i
JOIN publishers p ON p.name = i.publisher
JOIN genres     g ON g.name = i.genre
WHERE NOT EXISTS (SELECT 1 FROM books b WHERE b.title = i.title);

-- and their authors
INSERT INTO book_authors (book_id, author_id)
SELECT b.id, a.id
FROM incoming i
JOIN books   b ON b.title = i.title
JOIN authors a ON a.name  = i.author
ON CONFLICT DO NOTHING;

COMMIT;
